import { redirect } from "next/navigation";

import { auth } from "@/auth";

/**
 * Single post-authentication router: sends each role to its home. Kept
 * server-side so the client never decides where a session is allowed to go.
 */
export default async function PostLoginPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role === "admin" || session.user.role === "staff_admin") {
    redirect("/admin");
  }
  if (session.user.role === "partner_admin") redirect("/partner");
  if (session.user.tenantSlug) {
    redirect(`/org/${session.user.tenantSlug}/dashboard`);
  }
  redirect("/login");
}
