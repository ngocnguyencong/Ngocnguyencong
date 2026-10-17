export type WorkspaceExportCardCopy = Readonly<{
  title: string;
  description: string;
  action: string;
}>;

/**
 * Settings → General workspace data card. Rendered only for owner/admin
 * members — the route re-checks the role server-side. A plain anchor keeps
 * the download working without JavaScript.
 */
export function WorkspaceExportCard({ copy }: Readonly<{ copy: WorkspaceExportCardCopy }>) {
  return (
    <section aria-labelledby="workspace-export-title">
      <h3 id="workspace-export-title">{copy.title}</h3>
      <p>{copy.description}</p>
      <a className="button button-secondary" href="/api/workspace/export">
        {copy.action}
      </a>
    </section>
  );
}
