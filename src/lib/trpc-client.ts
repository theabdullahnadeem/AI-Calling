"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "@/server";

/**
 * Vanilla browser tRPC client for the dashboard's interactive islands
 * (search, live-call polling, call detail modal). Auth rides on the session
 * cookie; the server ignores everything else — scoping is session-side.
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
