import type { Carrier, OrderStatus } from "@/lib/order-status";
import type { Region } from "@/lib/pricing";
import type { OfferTier } from "@/lib/offer";

export type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  status: OrderStatus;
  rawStatus: string;
  governorate: string;
  /** Which storefront the order came from. Decides its currency. */
  region: Region;
  currency: string;
  carrier: Carrier;
  itemCount: number;
  createdAt: number | null;
  deliveredAt: number | null;
  /** Spend-offer tier the order reached; null when the offer wasn't running. */
  offerTier: OfferTier | null;
  /** What the offer cost on this order: its discount plus the waived fee. */
  offerCost: number;
};

export type OrdersResponse = {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgOrder: number;
    last30Orders: number;
    last30Revenue: number;
  };
  series: { date: string; revenue: number; count: number }[];
  orders: OrderRow[];
};

export type CollectionMeta = {
  handle: string;
  title: string;
  image: string;
  description?: string;
  count?: number;
};

export type CollectionsResponse = {
  collections: CollectionMeta[];
};
