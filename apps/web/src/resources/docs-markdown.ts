import type { Guide, SectionTable } from "./content";

/** Flattens a section table to plain text for search indexes. */
export function sectionTableText(table: SectionTable): string {
  return `${table.head.join(" ")} ${table.rows.map((row) => row.join(" ")).join(" ")}`;
}

/** Serializes a guide to Markdown for copy/download flows. */
export function guideToMarkdown(
  guide: Guide,
  continuation?: {
    label: string;
    title: string;
    href: string;
    setupFlow?: { sentence: string; title: string; href: string };
  },
): string {
  const blocks: string[] = [`# ${guide.title}`, "", guide.description];
  for (const section of guide.sections) {
    blocks.push("", `## ${section.title}`, "");
    for (const paragraph of section.paragraphs) {
      blocks.push(paragraph, "");
    }
    if (section.items !== undefined && section.items.length > 0) {
      blocks.push(...section.items.map((item) => `- ${item}`), "");
    }
    if (section.code !== undefined) {
      blocks.push("```", section.code, "```", "");
    }
    if (section.table !== undefined) {
      const cell = (value: string) => value.replace(/\|/g, "\\|");
      blocks.push(
        `| ${section.table.head.map(cell).join(" | ")} |`,
        `|${section.table.head.map(() => "---").join("|")}|`,
        ...section.table.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
        "",
      );
    }
    if (section.links) {
      blocks.push(
        ...section.links.map(
          (link) =>
            `- [${link.label}](${link.href})${link.description ? ` — ${link.description}` : ""}`,
        ),
        "",
      );
    }
  }
  if (continuation?.setupFlow) {
    const flow = continuation.setupFlow;
    blocks.push("", flow.sentence.replace("{guide}", `[${flow.title}](${flow.href})`), "");
  }
  if (continuation)
    blocks.push(
      "",
      `## ${continuation.label}`,
      "",
      `[${continuation.title}](${continuation.href})`,
      "",
    );
  return blocks.join("\n").trimEnd() + "\n";
}

export type DocsIndexEntry = Readonly<{
  description: string;
  group: string;
  slug: string;
  tab: string;
  text: string;
  title: string;
}>;

/**
 * Flattens guides into a JSON-serializable search index the client-side ⌘K
 * palette can filter without shipping section structures over the wire.
 */
export function buildDocsIndex(entries: readonly Guide[]): readonly DocsIndexEntry[] {
  return entries.map((guide) => ({
    description: guide.description,
    group: guide.group,
    slug: guide.slug,
    tab: guide.tab,
    text: `${guide.title} ${guide.group} ${guide.slug} ${guide.description} ${guide.sections
      .map(
        (section) =>
          `${section.title} ${section.paragraphs.join(" ")} ${section.code ?? ""} ${
            section.items?.join(" ") ?? ""
          } ${section.table ? sectionTableText(section.table) : ""} ${section.links?.map((link) => `${link.label} ${link.description ?? ""}`).join(" ") ?? ""}`,
      )
      .join(" ")}`.toLowerCase(),
    title: guide.title,
  }));
}
