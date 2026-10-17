"use client";

import type { WorkspaceAuditRow } from "./audit-runtime";

export function AuditLogSettings({
  audit,
}: Readonly<{
  audit: { error?: string; rows: WorkspaceAuditRow[] } | undefined;
}>) {
  if (audit === undefined) {
    return null;
  }
  if (audit.error !== undefined) {
    return <p role="status">{audit.error}</p>;
  }
  if (audit.rows.length === 0) {
    return <p>No audit events recorded yet.</p>;
  }
  return (
    <ul className="notification-list" aria-label="Workspace audit log">
      {audit.rows.map((row) => (
        <li key={row.id}>
          <strong>{row.label}</strong>
          <br />
          <span className="quiet-note">
            {new Date(row.createdAt).toLocaleString()}
            {row.actorEmail !== null ? ` · ${row.actorEmail}` : ""}
            {row.targetType !== null ? ` · ${row.targetType}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
