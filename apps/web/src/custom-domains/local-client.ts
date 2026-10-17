import {
  CustomDomainProviderError,
  type CustomDomainProvider,
  type CustomHostname,
} from "./provider";

/**
 * Offline custom-domain provider: every hostname is immediately "active" so
 * local development can exercise add/refresh/remove flows without Cloudflare.
 * State lives in memory for the life of the process.
 */
export function createLocalDomainClient(options: { cnameTarget: string }): CustomDomainProvider {
  const hostnames = new Map<string, CustomHostname>();

  return {
    async createHostname(input) {
      const hostname: CustomHostname = {
        hostname: input.hostname,
        id: `local_${input.hostname}`,
        sslStatus: "active",
        status: "active",
        verification: { cnameTarget: options.cnameTarget, dcvRecords: [] },
      };
      hostnames.set(hostname.id, hostname);
      return hostname;
    },
    async deleteHostname(id) {
      hostnames.delete(id);
    },
    async getHostname(id) {
      const hostname = hostnames.get(id);
      if (hostname === undefined) {
        throw new CustomDomainProviderError("Local custom hostname not found.", {
          status: 404,
        });
      }
      return hostname;
    },
  };
}
