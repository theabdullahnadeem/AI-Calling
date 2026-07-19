"use client";

import { useEffect, useRef, useState } from "react";

import {
  formatDateTime,
  formatDuration,
  sentimentDotClass,
} from "@/lib/format";
import { trpc } from "@/lib/trpc-client";
import { CallDetailModal } from "./call-detail-modal";

type CallRow = {
  id: string;
  createdAt: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "in-progress" | "completed" | "failed";
  durationSeconds: number | null;
  sentiment: "positive" | "neutral" | "negative" | "inquisitive" | null;
  phoneNumber: string;
  hasRecording: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Searchable/filterable call log. Search and filters run server-side through
 * the session-scoped callsList procedure — the client only ever narrows its
 * own tenant's data, never chooses whose.
 */
export function CallLog({ initialRows }: { initialRows: CallRow[] }) {
  const [rows, setRows] = useState<CallRow[]>(initialRows);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [openCallId, setOpenCallId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await trpc.tenant.callsList.query({
          search: search || undefined,
          direction: (direction || undefined) as CallRow["direction"] | undefined,
          status: (status || undefined) as CallRow["status"] | undefined,
          sentiment: (sentiment || undefined) as
            | NonNullable<CallRow["sentiment"]>
            | undefined,
          limit: 50,
        });
        setRows(result as CallRow[]);
      } catch {
        // Keep the last good rows; the next keystroke retries.
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, direction, status, sentiment]);

  return (
    <>
      <div className="dv-controls">
        <input
          className="dv-input dv-input--search"
          placeholder="Search by phone number or summary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search calls"
        />
        <select
          className="dv-select"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          aria-label="Filter by direction"
        >
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          className="dv-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="dv-select"
          value={sentiment}
          onChange={(e) => setSentiment(e.target.value)}
          aria-label="Filter by sentiment"
        >
          <option value="">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="inquisitive">Inquisitive</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      <div className="dv-table-wrap">
        <table className="dv-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Direction</th>
              <th>Number</th>
              <th>Duration</th>
              <th>Sentiment</th>
              <th>Status</th>
              <th>Recording</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="dv-empty">
                  No calls yet — once your line is live, they&apos;ll show up
                  here.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="dv-row-click"
                  onClick={() => setOpenCallId(row.id)}
                >
                  <td className="dv-num" suppressHydrationWarning>
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td>{row.direction === "inbound" ? "Inbound" : "Outbound"}</td>
                  <td className="dv-num">{row.phoneNumber}</td>
                  <td className="dv-num">
                    {formatDuration(row.durationSeconds)}
                  </td>
                  <td>
                    {row.sentiment ? (
                      <>
                        <span className={sentimentDotClass(row.sentiment)} />
                        {row.sentiment.charAt(0).toUpperCase() +
                          row.sentiment.slice(1)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {row.status === "failed" ? (
                      <>
                        <span className="dv-dot dv-dot--alert" />
                        Failed
                      </>
                    ) : row.status === "in-progress" ||
                      row.status === "ringing" ? (
                      <>
                        <span className="dv-dot dv-dot--signal" />
                        In progress
                      </>
                    ) : (
                      "Completed"
                    )}
                  </td>
                  <td>{row.hasRecording ? "Play" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openCallId ? (
        <CallDetailModal
          callId={openCallId}
          onClose={() => setOpenCallId(null)}
        />
      ) : null}
    </>
  );
}
