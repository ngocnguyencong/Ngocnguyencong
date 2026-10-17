import { NextResponse } from "next/server";

import { mobileOrganizationBff } from "../../../../src/mobile-organization";

export const runtime = "nodejs";

/** Members + pending invitations for the caller's active organization. */
export async function GET(request: Request) {
  const response = await mobileOrganizationBff.listMembers(request.headers);
  return NextResponse.json(response.body, { status: response.status });
}

/** Creates a new organization workspace for the signed-in user. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const response = await mobileOrganizationBff.createOrganization(request.headers, {
    name: body.name,
  });
  return NextResponse.json(response.body, { status: response.status });
}

/** Renames the active organization (owner only). */
export async function PATCH(request: Request) {
  const body = await readJson(request);
  const response = await mobileOrganizationBff.renameOrganization(request.headers, {
    name: body.name,
  });
  return NextResponse.json(response.body, { status: response.status });
}

/** Deletes the active organization (owner only, name confirmation). */
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const response = await mobileOrganizationBff.deleteOrganization(request.headers, {
    confirm: body.confirm,
  });
  return NextResponse.json(response.body, { status: response.status });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
