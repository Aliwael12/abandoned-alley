import { NextResponse } from "next/server";
import { sql, toMillis } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await sql`select * from contact_messages order by created_at desc`;
    const messages = rows.map((data) => {
      return {
        id: String(data.id),
        name: String(data.name ?? ""),
        email: String(data.email ?? ""),
        message: String(data.message ?? ""),
        status: String(data.status ?? "new"),
        createdAt: toMillis(data.createdAt),
      };
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Contact list failed:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
