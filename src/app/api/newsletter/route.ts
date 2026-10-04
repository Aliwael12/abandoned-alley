import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String((body as { email?: unknown })?.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await sql`
      insert into subscribers (email, status, subscribed_at) values (${email}, 'subscribed', now())
      on conflict (email) do update set status = 'subscribed', subscribed_at = now()`;
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
