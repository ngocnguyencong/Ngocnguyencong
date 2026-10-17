import { clientIpForRequest } from "../rate-limit";
import { trustedProxyCount } from "../rate-limit-runtime";

export interface GeoResult {
  country: string | null;
  region: string | null;
  city: string | null;
}

function decodeGeo(value: string | null): string | null {
  if (value === null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Geo from platform headers (Vercel/Cloudflare); nulls in local dev. */
export function geoFromHeaders(headers: Headers): GeoResult {
  const country = headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry");
  return {
    country: country === null ? null : country.toLowerCase(),
    region: headers.get("x-vercel-ip-country-region"),
    city: decodeGeo(headers.get("x-vercel-ip-city") ?? headers.get("cf-ipcity")),
  };
}

export function clientIp(headers: Headers): string {
  return clientIpForRequest(headers, trustedProxyCount);
}
