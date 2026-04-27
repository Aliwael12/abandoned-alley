export type OrderRow = {
  id: string;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  status: string;
  itemCount: number;
  createdAt: number | null;
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
