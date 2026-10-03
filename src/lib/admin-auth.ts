import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-session";

export { ADMIN_COOKIE };

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return verifyAdminSession(c.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
