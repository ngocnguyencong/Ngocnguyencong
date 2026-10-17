import { describe, expect, it } from "vitest";

import {
  growthCookiesToSet,
  INVITE_COOKIE,
  REFERRAL_COOKIE,
  readGrowthCookies,
} from "./growth-cookies";

describe("growthCookiesToSet", () => {
  it("emits httpOnly cookies for ?ref= and ?invite=", () => {
    const sets = growthCookiesToSet(new URLSearchParams("?ref=abc123&invite=xyz789"));
    const ref = sets.find((s) => s.name === REFERRAL_COOKIE);
    const invite = sets.find((s) => s.name === INVITE_COOKIE);
    expect(ref?.value).toBe("abc123");
    expect(ref?.options.httpOnly).toBe(true);
    expect(ref?.options.sameSite).toBe("lax");
    expect(ref?.options.path).toBe("/");
    expect(ref?.options.maxAge).toBeGreaterThan(0);
    expect(invite?.value).toBe("xyz789");
    expect(invite?.options.httpOnly).toBe(true);
  });

  it("ignores absent or malformed params and never overwrites a valid code with junk", () => {
    expect(growthCookiesToSet(new URLSearchParams())).toEqual([]);
    expect(growthCookiesToSet(new URLSearchParams("?ref=<script>"))).toEqual([]);
    expect(
      growthCookiesToSet(new URLSearchParams("?ref=ok&invite=has space")).map((s) => s.name),
    ).toEqual([REFERRAL_COOKIE]);
  });
});

describe("readGrowthCookies", () => {
  const store = (values: Record<string, string>) => ({
    get(name: string) {
      return values[name] ? { name, value: values[name]! } : undefined;
    },
  });

  it("returns sanitized values from the cookie jar", () => {
    expect(
      readGrowthCookies(store({ [REFERRAL_COOKIE]: "Ref42", [INVITE_COOKIE]: "Code9" })),
    ).toEqual({ ref: "ref42", invite: "code9" });
  });

  it("drops tampered cookie values instead of trusting them", () => {
    expect(
      readGrowthCookies(store({ [REFERRAL_COOKIE]: "../../etc", [INVITE_COOKIE]: "x" })),
    ).toEqual({ ref: null, invite: "x" });
    expect(readGrowthCookies(store({}))).toEqual({ ref: null, invite: null });
  });
});
