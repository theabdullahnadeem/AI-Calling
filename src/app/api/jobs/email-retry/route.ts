import { timingSafeEqual } from "crypto";

import { retryFailedBookingEmails } from "@/lib/booking";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  // Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically
  // when the env var exists; any other scheduler must do the same. Without
  // this check the route would be a public email-sending trigger.
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${serverEnv("CRON_SECRET")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await retryFailedBookingEmails();
  return Response.json(result);
}
