import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import {
  ONBOARDING_STEP_COOKIE,
  normalizeOnboardingStep,
} from "../../../../src/organization-constants";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jar = await cookies();
  const step = normalizeOnboardingStep(jar.get(ONBOARDING_STEP_COOKIE)?.value ?? null);
  return NextResponse.json({ step }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stepRaw =
    typeof body === "object" && body !== null && "step" in body ? body.step : undefined;
  const step = normalizeOnboardingStep(typeof stepRaw === "string" ? stepRaw : null);
  if (step === null) {
    return NextResponse.json({ error: "Unknown onboarding step" }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(ONBOARDING_STEP_COOKIE, step, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return NextResponse.json({ ok: true, step }, { status: 200 });
}
