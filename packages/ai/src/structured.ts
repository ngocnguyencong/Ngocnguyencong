import { z } from "zod";

import type {
  AiCompletionRequest,
  AiExecutionResult,
  AiProviderAttemptHooks,
  ModelRequirements,
} from "./contracts";

/** The subset of `ModelRouter` needed for structured completions. */
export interface StructuredRouter {
  complete(
    request: AiCompletionRequest,
    hooks?: AiProviderAttemptHooks,
  ): Promise<AiExecutionResult>;
}

export interface StructuredCompletionRequest<T> extends Omit<
  AiCompletionRequest,
  "input" | "requirements"
> {
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
  readonly schemaName: string;
  readonly requirements?: ModelRequirements;
  /** Default 2 — one initial call plus a single repair retry. */
  readonly maxAttempts?: 1 | 2;
}

export interface StructuredCompletion<T> {
  readonly value: T;
  readonly result: AiExecutionResult;
  readonly attempts: number;
}

export class StructuredOutputError extends Error {
  readonly issues: readonly string[];
  readonly attempts: number;

  constructor(issues: readonly string[], attempts: number) {
    super(
      `Structured output failed schema validation after ${attempts} attempt(s): ${issues.join("; ")}`,
    );
    this.name = "StructuredOutputError";
    this.issues = issues;
    this.attempts = attempts;
  }
}

const RAW_OUTPUT_LIMIT = 2_000;

/**
 * Prompts the router for a JSON document matching `schema` and validates it.
 * On a schema violation the raw output (truncated to 2,000 chars) and the zod
 * issues are folded into a single repair retry; a second failure throws
 * `StructuredOutputError` (raw model text never lands in the message).
 */
export async function completeStructured<T>(
  router: StructuredRouter,
  request: StructuredCompletionRequest<T>,
  hooks?: AiProviderAttemptHooks,
): Promise<StructuredCompletion<T>> {
  const maxAttempts = request.maxAttempts ?? 2;
  const requirements: ModelRequirements = {
    ...request.requirements,
    structuredOutput: true,
  };
  let issues: readonly string[] = [];
  let previousRaw = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = composePrompt(request, attempt === 1 ? undefined : { issues, previousRaw });
    const result = await router.complete(
      {
        alias: request.alias,
        ...(request.estimatedUsage === undefined ? {} : { estimatedUsage: request.estimatedUsage }),
        input: { prompt },
        requirements,
        workspace: request.workspace,
      },
      hooks,
    );

    const parsed = parseStructured(request.schema, result.text, request.schemaName);
    if (parsed.ok) {
      return Object.freeze({ attempts: attempt, result, value: parsed.value });
    }
    issues = parsed.issues;
    previousRaw = result.text;
  }

  throw new StructuredOutputError(issues, maxAttempts);
}

type RepairContext = Readonly<{ issues: readonly string[]; previousRaw: string }>;

function composePrompt<T>(
  request: StructuredCompletionRequest<T>,
  repair: RepairContext | undefined,
): string {
  const schemaJson = JSON.stringify(z.toJSONSchema(request.schema));
  const sections = [
    request.prompt,
    `Answer with a single JSON object only — no prose, no markdown fences. The object must be named "${request.schemaName}" and satisfy this JSON Schema:`,
    schemaJson,
  ];
  if (repair !== undefined) {
    sections.push(
      "The previous response failed validation with these issues:",
      repair.issues.join("; "),
      "Previous response (truncated):",
      repair.previousRaw.slice(0, RAW_OUTPUT_LIMIT),
      "Return a corrected single JSON object only.",
    );
  }
  return sections.join("\n\n");
}

type ParseOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] };

function parseStructured<T>(
  schema: z.ZodType<T>,
  text: string,
  schemaName: string,
): ParseOutcome<T> {
  const candidate = extractJson(text);
  if (candidate === undefined) {
    return { issues: ["Response did not contain a JSON object."], ok: false };
  }

  let value: unknown;
  try {
    value = JSON.parse(candidate);
  } catch {
    return { issues: ["Response contained malformed JSON."], ok: false };
  }

  // Models often honor the literal instruction "the object must be named X"
  // by wrapping the payload in `{"<schemaName>": {…}}` — unwrap that envelope
  // so the payload validates instead of failing on a presentational quirk.
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    schemaName in value &&
    typeof (value as Record<string, unknown>)[schemaName] === "object" &&
    (value as Record<string, unknown>)[schemaName] !== null &&
    !Array.isArray((value as Record<string, unknown>)[schemaName])
  ) {
    value = (value as Record<string, unknown>)[schemaName];
  }

  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return {
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
    ok: false,
  };
}

/** Whole-text JSON, ```json fenced block, or the outermost {…} span. */
function extractJson(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1] !== undefined) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return undefined;
  }
  return trimmed.slice(start, end + 1);
}
