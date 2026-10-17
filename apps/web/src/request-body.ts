const MAX_WEBHOOK_BYTES = 1_048_576;
export const MAX_IMAGE_UPLOAD_BODY_BYTES = 2_621_440;
export const MAX_JSON_BODY_BYTES = 65_536;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("The request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

async function readBoundedBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new RequestBodyTooLargeError();
  }
  const reader = request.body?.getReader();
  if (reader === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new RequestBodyTooLargeError();
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBoundedBytes(request, maxBytes));
}

export async function readBoundedJson(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  return JSON.parse(await readBoundedText(request, maxBytes)) as unknown;
}

export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const bytes = await readBoundedBytes(request, maxBytes);
  return new Request(request.url, {
    body: bytes.buffer as ArrayBuffer,
    headers: { "content-type": request.headers.get("content-type") ?? "" },
    method: "POST",
  }).formData();
}

export async function readWebhookPayload(
  request: Request,
): Promise<{ payload: string } | { response: Response }> {
  try {
    return { payload: await readBoundedText(request, MAX_WEBHOOK_BYTES) };
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return {
      response: Response.json(
        { error: { code: "validationError", message: "Webhook payload is too large." } },
        { status: 413 },
      ),
    };
  }
}

export async function readImageUploadFormData(
  request: Request,
): Promise<{ form: FormData } | { response: Response }> {
  try {
    return { form: await readBoundedFormData(request, MAX_IMAGE_UPLOAD_BODY_BYTES) };
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return { response: Response.json({ error: "Image upload is too large." }, { status: 413 }) };
  }
}

export function createConcurrentRequestGate(maxInFlight: number) {
  let inFlight = 0;
  return {
    async run<T>(operation: () => Promise<T>): Promise<T | null> {
      if (inFlight >= maxInFlight) return null;
      inFlight += 1;
      try {
        return await operation();
      } finally {
        inFlight -= 1;
      }
    },
  };
}

export async function readBoundedRequest(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<{ request: Request } | { response: Response }> {
  const hadBody = request.body !== null;
  try {
    const bytes = await readBoundedBytes(request, maxBytes);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    const init: RequestInit = {
      headers,
      method: request.method,
      signal: request.signal,
    };
    if (hadBody) {
      Object.assign(init, {
        body: bytes.buffer as ArrayBuffer,
        duplex: "half",
      });
    }
    return { request: new Request(request.url, init) };
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return {
      response: Response.json(
        { error: { code: "validationError", message: "Request body is too large." } },
        { status: 413 },
      ),
    };
  }
}
