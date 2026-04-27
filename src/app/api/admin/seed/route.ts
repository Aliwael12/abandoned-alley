import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { seedFromStatic } from "@/lib/products-server";

export const runtime = "nodejs";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await seedFromStatic();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
