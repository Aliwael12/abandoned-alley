import { NextResponse } from "next/server";
import { Timestamp, collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tsToMillis(ts: unknown): number | null {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === "object" && "seconds" in ts) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snap = await getDocs(
      query(collection(db, "contact"), orderBy("createdAt", "desc"))
    );
    const messages = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? ""),
        email: String(data.email ?? ""),
        message: String(data.message ?? ""),
        status: String(data.status ?? "new"),
        createdAt: tsToMillis(data.createdAt),
      };
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Contact list failed:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
