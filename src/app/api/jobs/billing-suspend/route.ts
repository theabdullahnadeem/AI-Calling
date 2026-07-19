import { and, eq, inArray, lt } from "drizzle-orm";

import { db, subscriptions, tenants } from "@/db";
import { verifyQStashRequest } from "@/lib/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRACE_DAYS = 3;

/**
 * Daily QStash job (Prompt 6 item 8). Polar explicitly does NOT enforce
 * usage caps or block access — cutting off a tenant after the 3-day grace
 * window is entirely our responsibility. Suspends both the subscription row
 * (billing state) and the tenant row (the hard dashboard block enforced by
 * the org layout and tRPC middleware).
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyQStashRequest(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const expired = await db
    .update(subscriptions)
    .set({ status: "suspended" })
    .where(
      and(
        eq(subscriptions.status, "payment_overdue"),
        lt(subscriptions.overdueSince, cutoff),
      ),
    )
    .returning({ tenantId: subscriptions.tenantId });

  if (expired.length > 0) {
    await db
      .update(tenants)
      .set({ status: "suspended" })
      .where(
        inArray(
          tenants.id,
          expired.map((row) => row.tenantId),
        ),
      );
    console.log(
      `[billing-suspend] suspended ${expired.length} tenant(s) past the ${GRACE_DAYS}-day grace window`,
    );
  }

  return Response.json({ suspended: expired.length });
}
