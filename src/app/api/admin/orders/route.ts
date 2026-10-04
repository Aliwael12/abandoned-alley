import { NextResponse } from "next/server";
import { sql, toMillis } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { REGION_CURRENCY, toRegion, type Region } from "@/lib/pricing";
import {
  carrierForGovernorate,
  normalizeStatus,
  type Carrier,
  type OrderStatus,
} from "@/lib/order-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  status: OrderStatus;
  rawStatus: string;
  governorate: string;
  region: Region;
  currency: string;
  carrier: Carrier;
  itemCount: number;
  createdAt: number | null;
  deliveredAt: number | null;
  offerTier: string | null;
  offerCost: number;
};

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orders;
  try {
    orders = await sql`select * from orders order by created_at desc`;
  } catch (err) {
    console.error("Orders fetch error:", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }

  const rows: OrderRow[] = orders.map((data) => {
    const customer = (data.customer ?? {}) as Record<string, unknown>;
    const shipping = (data.shipping ?? {}) as Record<string, unknown>;
    const items = Array.isArray(data.items) ? (data.items as { quantity: number }[]) : [];
    const governorate = String(shipping.state ?? "");
    // Legacy orders predate the field and were all Egypt.
    const region = toRegion(data.region);
    const rawStatus = String(data.status ?? "pending");
    return {
      id: String(data.id),
      customerName: String(customer.name ?? ""),
      customerEmail: String(customer.email ?? ""),
      customerPhone: String(customer.phone ?? ""),
      subtotal: Number(data.subtotal ?? 0),
      status: normalizeStatus(rawStatus),
      rawStatus,
      governorate,
      region,
      currency: String(data.currency ?? REGION_CURRENCY[region]),
      carrier: carrierForGovernorate(),
      itemCount: items.reduce((n, i) => n + Number(i.quantity ?? 0), 0),
      createdAt: toMillis(data.createdAt),
      deliveredAt: toMillis(data.deliveredAt),
      offerTier: typeof data.offerTier === "string" ? data.offerTier : null,
      offerCost: Number(data.offerDiscount ?? 0) + Number(data.deliveryFeeWaived ?? 0),
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
