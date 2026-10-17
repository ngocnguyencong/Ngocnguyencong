import { parseServerConfig } from "@supastack/config";
import { getSharedLocalOutboxEmailSender } from "@supastack/email";
import { notFound } from "next/navigation";

import { WorkspaceShell } from "../../src/app-chrome";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS } from "../../src/transactional-mail-templates";

export const dynamic = "force-dynamic";

export default async function MailPreviewPage() {
  const config = parseServerConfig();
  if (config.app.environment === "production" || config.providers.email.kind !== "local") {
    notFound();
  }

  const deliveries = getSharedLocalOutboxEmailSender().listDeliveries();

  const brand = await getRequestBrand();

  return (
    <WorkspaceShell active="Settings" brand={brand} workspaceLabel="Local mail preview">
      <div className="auth-card auth-form mail-preview">
        <h1>Mail preview</h1>
        <p>
          Local transactional outbox for development. Production and remote email providers hide
          this route. Outreach templates are intentionally excluded.
        </p>

        <h2>Template catalog</h2>
        <ol>
          {TRANSACTIONAL_MAIL_TEMPLATE_PREVIEWS.map((template) => (
            <li key={template.id}>
              <p>
                <strong>{template.subject}</strong>
              </p>
              <p>
                Template {template.id} · {template.category}
              </p>
              <pre className="mail-preview-body">{template.text}</pre>
            </li>
          ))}
        </ol>

        <h2>Process outbox</h2>
        {deliveries.length === 0 ? (
          <p>No queued deliveries in this process yet.</p>
        ) : (
          <ol>
            {deliveries.map((delivery) => (
              <li key={delivery.id}>
                <p>
                  <strong>{delivery.subject}</strong>
                </p>
                <p>
                  To {delivery.to} · workspace {delivery.workspaceId} · {delivery.status}
                </p>
                <pre className="mail-preview-body">{delivery.text}</pre>
              </li>
            ))}
          </ol>
        )}
        <a href="/api/docs">OpenAPI docs</a>
      </div>
    </WorkspaceShell>
  );
}
