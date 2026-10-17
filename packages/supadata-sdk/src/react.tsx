/**
 * <SupadataScript> — drop-in tracker tag for React/Next layouts.
 * Server-component safe: renders a plain deferred <script>.
 */

export interface SupadataScriptProps {
  websiteId: string;
  /** App origin for self-hosted collectors (default: the script's own origin). */
  apiUrl?: string;
  /** Extra hostnames allowed to send events (comma-separated). */
  domain?: string;
  cookieless?: boolean;
  src?: string;
}

export function SupadataScript({
  websiteId,
  apiUrl,
  domain,
  cookieless,
  src = "/sd.js",
}: SupadataScriptProps) {
  return (
    <script
      defer
      data-website-id={websiteId}
      data-api-url={apiUrl}
      data-domain={domain}
      data-cookieless={cookieless ? "true" : undefined}
      src={src}
    />
  );
}
