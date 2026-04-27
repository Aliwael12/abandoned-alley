import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
