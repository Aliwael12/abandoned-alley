import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSession,
} from "@/lib/admin-session";

export const runtime = "nodejs";

/** Equal-length digests, so the comparison takes the same time whatever the guess. */
function passwordMatches(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (typeof body.password !== "string" || !passwordMatches(body.password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await createAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const c = await cookies();
  c.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
