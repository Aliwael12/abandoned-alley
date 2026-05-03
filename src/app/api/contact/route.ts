import { NextResponse } from "next/server";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ADMIN_EMAIL, EMAIL_FROM, resend } from "@/lib/email";

export const runtime = "nodejs";

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const message = String(b.message ?? "").trim().slice(0, 2000);

  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!isValidEmail(email))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!message)
    return NextResponse.json({ error: "Message required" }, { status: 400 });

  try {
    await addDoc(collection(db, "contact"), {
      name,
      email,
      message,
      status: "new",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Contact save failed:", err);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      replyTo: email,
      subject: `New contact message — ${name}`,
      html: `
        <div style="background:#0a0a0a;color:#eee;font-family:Helvetica,Arial,sans-serif;padding:32px;max-width:600px;margin:auto;">
          <h2 style="margin:0 0 16px;">New contact message</h2>
          <p style="margin:0;color:#aaa;">
            <strong>${escape(name)}</strong><br/>
            ${escape(email)}
          </p>
          <h3 style="margin-top:24px;color:#eee;letter-spacing:0.1em;">Message</h3>
          <p style="color:#ddd;line-height:1.6;white-space:pre-wrap;margin:0;">${escape(
            message
          )}</p>
        </div>`,
    });
  } catch (err) {
    console.error("Contact email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
