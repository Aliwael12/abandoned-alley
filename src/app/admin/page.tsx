import { requireAdmin } from "@/lib/admin-auth";
import AdminDashboard from "./AdminDashboard";

export const metadata = { title: "Admin — Abandoned Alley" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <AdminDashboard />
    </div>
  );
}
