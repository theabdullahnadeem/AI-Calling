"use client";

import { useEffect, useState } from "react";

import { formatNumber } from "@/lib/format";
import { trpc } from "@/lib/trpc-client";

const LIVE_POLL_MS = 8000;

/**
 * Performance cards with the design doc's signature element: when a call is
 * live (Redis-cached status from Prompt 3), the "Calls received" card gets a
 * pulsing dot and a thin signal line on its top edge — the one piece of
 * motion in the whole interface, and it's functional: the dashboard proving
 * the system is alive in real time.
 */
export function PerformanceCards({
  inboundCalls,
  outboundCalls,
  bookingsSecured,
  initialLiveCount,
}: {
  inboundCalls: number;
  outboundCalls: number;
  bookingsSecured: number;
  initialLiveCount: number;
}) {
  const [liveCount, setLiveCount] = useState(initialLiveCount);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const live = await trpc.tenant.liveCalls.query();
        setLiveCount(live.length);
      } catch {
        // Polling failure is not worth surfacing; the next tick retries.
      }
    }, LIVE_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const isLive = liveCount > 0;

  return (
    <div className="dv-cards">
      <div className={`dv-card${isLive ? " dv-card--live" : ""}`}>
        <div className="dv-card-value">{formatNumber(inboundCalls)}</div>
        <div className="dv-card-label">
          Calls received
          {isLive ? (
            <>
              <span className="dv-live-dot" aria-hidden />
              <span style={{ color: "var(--signal)" }}>
                {liveCount === 1 ? "1 call live now" : `${liveCount} calls live now`}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="dv-card">
        <div className="dv-card-value">{formatNumber(outboundCalls)}</div>
        <div className="dv-card-label">Outbound follow-ups</div>
      </div>
      <div className="dv-card">
        <div className="dv-card-value">{formatNumber(bookingsSecured)}</div>
        <div className="dv-card-label">Bookings secured</div>
      </div>
    </div>
  );
}
