/**
 * Provider-neutral custom-domain client contract. Cloudflare for SaaS is the
 * production implementation; `local` activates immediately for development.
 */

export type CustomDomainStatus = "active" | "deleted" | "failed" | "moved" | "pending";

export interface DomainVerificationRecord {
  cname?: string;
  cnameTarget?: string;
  httpBody?: string;
  httpUrl?: string;
  status?: string;
  txtName?: string;
  txtValue?: string;
}

export interface DomainVerification {
  cnameTarget: string;
  dcvRecords: DomainVerificationRecord[];
  ownership?: { name: string; type: string; value: string };
}

export interface CustomHostname {
  hostname: string;
  id: string;
  sslStatus: string | null;
  status: CustomDomainStatus;
  verification: DomainVerification;
}

export interface CustomDomainProvider {
  createHostname(input: {
    hostname: string;
    metadata: Record<string, string>;
  }): Promise<CustomHostname>;
  deleteHostname(id: string): Promise<void>;
  getHostname(id: string): Promise<CustomHostname>;
}

export class CustomDomainProviderError extends Error {
  readonly status: number | undefined;

  constructor(message: string, options?: { status?: number }) {
    super(message);
    this.name = "CustomDomainProviderError";
    this.status = options?.status;
  }
}
