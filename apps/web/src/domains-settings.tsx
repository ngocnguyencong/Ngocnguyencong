"use client";

import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import {
  addWorkspaceDomain,
  refreshWorkspaceDomain,
  removeWorkspaceDomain,
  type DomainActionResult,
  type WorkspaceDomainsPage,
} from "./custom-domains/domain-actions";

function statusTone(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    case "moved":
      return "Moved";
    case "deleted":
      return "Deleted";
    default:
      return status;
  }
}

function DnsRecord({ name, value }: { name: string; value: string }) {
  return (
    <p className="quiet-note" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
      <strong>{name}</strong> → {value}
    </p>
  );
}

export function DomainsSettings({ data }: { data: WorkspaceDomainsPage }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<DomainActionResult>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await action();
      if (result.error !== undefined) {
        setMessage(result.error);
      } else {
        router.refresh();
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const hostname = new FormData(form).get("hostname");
    if (typeof hostname !== "string") return;
    void run(async () => {
      const result = await addWorkspaceDomain({ hostname });
      if (result.ok) form.reset();
      return result;
    });
  }

  if (!data.enabled) {
    return (
      <p className="quiet-note">
        Custom domains are disabled on this deployment. Set CUSTOM_DOMAINS_PROVIDER=local for
        development or cloudflare with CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, and
        CUSTOM_DOMAIN_CNAME_TARGET.
      </p>
    );
  }
  if (!data.manageable) {
    return <p className="quiet-note">{data.error ?? "Owner or admin role required."}</p>;
  }

  return (
    <>
      <p>
        White-label this workspace on its own hostname. Customers point a CNAME record at{" "}
        <strong>{data.cnameTarget}</strong>; once Cloudflare verifies the hostname it becomes an
        active trusted origin.
      </p>

      {data.domains.length === 0 ? (
        <p className="quiet-note">No custom domains yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.domains.map((domain) => (
            <li
              className="auth-card"
              key={domain.id}
              style={{ marginBottom: 12, padding: "14px 16px" }}
            >
              <p style={{ alignItems: "center", display: "flex", gap: 8, margin: "0 0 4px" }}>
                <Globe aria-hidden="true" size={16} />
                <strong>{domain.hostname}</strong>
                <span className="quiet-note">
                  {statusTone(domain.status)}
                  {domain.sslStatus === null ? "" : ` · TLS ${domain.sslStatus}`}
                </span>
              </p>
              {domain.status === "active" ? null : (
                <div aria-label={`DNS records for ${domain.hostname}`}>
                  <DnsRecord name={`CNAME ${domain.hostname}`} value={domain.cnameTarget} />
                  {domain.ownership === undefined ? null : (
                    <DnsRecord
                      name={`TXT ${domain.ownership.name}`}
                      value={domain.ownership.value}
                    />
                  )}
                  {domain.dcvRecords.map((record, index) =>
                    record.txtName === undefined || record.txtValue === undefined ? null : (
                      <DnsRecord
                        key={index}
                        name={`TXT ${record.txtName}`}
                        value={record.txtValue}
                      />
                    ),
                  )}
                </div>
              )}
              <p style={{ display: "flex", gap: 8, margin: "8px 0 0" }}>
                <button
                  className="button button-secondary"
                  disabled={pending}
                  onClick={() => void run(() => refreshWorkspaceDomain(domain.id))}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={14} /> Refresh status
                </button>
                <button
                  className="button button-secondary"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${domain.hostname}?`)) {
                      void run(() => removeWorkspaceDomain(domain.id));
                    }
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={14} /> Remove
                </button>
              </p>
            </li>
          ))}
        </ul>
      )}

      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="custom-domain-hostname">Add a custom domain</label>
        <input
          autoComplete="off"
          disabled={pending || data.domains.length >= 5}
          id="custom-domain-hostname"
          name="hostname"
          placeholder="portal.example.com"
          required
          type="text"
        />
        <button
          className="button button-primary"
          disabled={pending || data.domains.length >= 5}
          type="submit"
        >
          <Plus aria-hidden="true" size={14} /> Add domain
        </button>
        {data.domains.length >= 5 ? (
          <p className="quiet-note">Workspace limit of 5 domains reached.</p>
        ) : null}
      </form>

      {message === null ? null : <p role="status">{message}</p>}
    </>
  );
}
