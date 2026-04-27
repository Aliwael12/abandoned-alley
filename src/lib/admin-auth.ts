import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "aa_admin";
export const ADMIN_COOKIE_VALUE = "ok";

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return c.get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
