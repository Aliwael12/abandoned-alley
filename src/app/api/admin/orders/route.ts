import { NextResponse } from "next/server";
import {
  Timestamp,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  status: string;
  itemCount: number;
  createdAt: number | null;
};

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let snap;
  try {
    snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  } catch (err) {
    console.error("Orders fetch error:", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }

  const rows: OrderRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const items = Array.isArray(data.items) ? (data.items as { quantity: number }[]) : [];
    const ts = data.createdAt;
    let createdAt: number | null = null;
    if (ts instanceof Timestamp) createdAt = ts.toMillis();
    else if (typeof ts === "object" && ts !== null && "seconds" in ts) {
      createdAt = (ts as { seconds: number }).seconds * 1000;
    }
    return {
      id: d.id,
      customerName: String(customer.name ?? ""),
      customerEmail: String(customer.email ?? ""),
      subtotal: Number(data.subtotal ?? 0),
      status: String(data.status ?? "pending"),
      itemCount: items.reduce((n, i) => n + Number(i.quantity ?? 0), 0),
      createdAt,
    };
  });

  const totalRevenue = rows.reduce((n, r) => n + r.subtotal, 0);
  const totalOrders = rows.length;
  const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;

  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - 30 * dayMs;
  const last30 = rows.filter((r) => r.createdAt && r.createdAt >= cutoff);
  const last30Revenue = last30.reduce((n, r) => n + r.subtotal, 0);

  // last 7 days bucketed (oldest → newest)
  const buckets: { date: string; revenue: number; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const start = today.getTime() - i * dayMs;
    const end = start + dayMs;
    const dayRows = rows.filter(
      (r) => r.createdAt && r.createdAt >= start && r.createdAt < end
    );
    buckets.push({
      date: new Date(start).toISOString().slice(0, 10),
      revenue: dayRows.reduce((n, r) => n + r.subtotal, 0),
      count: dayRows.length,
    });
  }

  return NextResponse.json({
    summary: {
      totalOrders,
      totalRevenue,
      avgOrder,
      last30Orders: last30.length,
      last30Revenue,
    },
    series: buckets,
    orders: rows,
  });
}
