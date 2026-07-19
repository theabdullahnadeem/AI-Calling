import { retryFailedBookingEmails } from "@/lib/booking";
import { verifyQStashRequest } from "@/lib/qstash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled by QStash (see scripts/setup-qstash.ts) every 15 minutes.
 * QStash delivers via POST with a signed JWT; without a valid signature this
 * route does nothing — it must never be a public email-sending trigger.
 */
export async function POST(req: Request): Promise<Response> {
  if (!(await verifyQStashRequest(req))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await retryFailedBookingEmails();
  return Response.json(result);
}
