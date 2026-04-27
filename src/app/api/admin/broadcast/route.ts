import { NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resend, EMAIL_FROM } from "@/lib/email";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

type BroadcastBody = {
  subject?: string;
  html?: string;
  text?: string;
};

export async function POST(request: Request) {
  const token = request.headers.get("x-admin-token");
  const tokenOk =
    Boolean(token) && token === process.env.ADMIN_BROADCAST_TOKEN;
  const cookieOk = await isAdmin();
  if (!tokenOk && !cookieOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BroadcastBody;
  try {
    body = (await request.json()) as BroadcastBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = body.subject?.trim();
  const html = body.html?.trim();
  if (!subject || !html) {
    return NextResponse.json({ error: "subject and html required" }, { status: 400 });
  }

  let emails: string[];
  try {
    const snap = await getDocs(
      query(collection(db, "subscribers"), where("status", "==", "subscribed"))
    );
    emails = snap.docs.map((d) => String(d.data().email)).filter(Boolean);
  } catch (err) {
    console.error("Firestore subscribers fetch error:", err);
    return NextResponse.json({ error: "Failed to load subscribers" }, { status: 500 });
  }

  if (emails.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No subscribers" });
  }

  // Resend's batch endpoint accepts up to 100 per call.
  const BATCH = 100;
  let sent = 0;
  const failures: string[] = [];

  for (let i = 0; i < emails.length; i += BATCH) {
    const slice = emails.slice(i, i + BATCH);
    const payload = slice.map((to) => ({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      ...(body.text ? { text: body.text } : {}),
    }));
    const res = await resend.batch.send(payload);
    if (res.error) {
      failures.push(...slice);
      console.error("Resend batch error:", res.error);
    } else {
      sent += slice.length;
    }
  }

  return NextResponse.json({ ok: true, sent, failed: failures.length });
}
