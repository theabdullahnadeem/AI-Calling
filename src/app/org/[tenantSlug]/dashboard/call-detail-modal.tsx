"use client";

import { useEffect, useRef, useState } from "react";

import { formatDateTime, formatDuration } from "@/lib/format";
import { trpc } from "@/lib/trpc-client";

type CallDetail = {
  id: string;
  createdAt: string;
  direction: string;
  status: string;
  durationSeconds: number | null;
  sentiment: string | null;
  phoneNumber: string;
  summary: string | null;
  transcript: unknown;
  playbackUrl: string | null;
};

type Utterance = {
  role: string;
  content: string;
  startSeconds: number | null;
  endSeconds: number | null;
};

/** Retell transcript_object → utterances with start/end from word timings. */
function parseTranscript(raw: unknown): Utterance[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const entry = item as {
      role?: unknown;
      content?: unknown;
      words?: Array<{ start?: unknown; end?: unknown }>;
    };
    if (typeof entry.content !== "string") return [];
    const words = Array.isArray(entry.words) ? entry.words : [];
    const first = words[0]?.start;
    const last = words[words.length - 1]?.end;
    return [
      {
        role: typeof entry.role === "string" ? entry.role : "speaker",
        content: entry.content,
        startSeconds: typeof first === "number" ? first : null,
        endSeconds: typeof last === "number" ? last : null,
      },
    ];
  });
}

/**
 * Transcript + audio view — opens over the call log rather than navigating
 * away. The audio src is a fresh, short-lived presigned URL fetched on open;
 * nothing permanent is ever held client-side (Prompt 8 item 5).
 */
export function CallDetailModal({
  callId,
  onClose,
}: {
  callId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelled = false;
    trpc.tenant.callDetail
      .query({ callId })
      .then((data) => {
        if (!cancelled) setDetail(data as CallDetail);
      })
      .catch(() => {
        if (!cancelled) {
          setError("This call couldn't be loaded — try again in a moment.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [callId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const utterances = detail ? parseTranscript(detail.transcript) : [];

  function onTimeUpdate() {
    const current = audioRef.current?.currentTime;
    if (current === undefined) return;
    const index = utterances.findIndex(
      (u) =>
        u.startSeconds !== null &&
        u.endSeconds !== null &&
        current >= u.startSeconds &&
        current <= u.endSeconds,
    );
    if (index !== activeIndex) setActiveIndex(index);
  }

  function seekTo(utterance: Utterance) {
    if (audioRef.current && utterance.startSeconds !== null) {
      audioRef.current.currentTime = utterance.startSeconds;
    }
  }

  return (
    <div
      className="dv-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dv-modal" role="dialog" aria-modal="true">
        <div className="dv-modal-head">
          <div>
            <strong>{detail?.phoneNumber ?? "Call"}</strong>
            <span style={{ color: "var(--slate)", marginLeft: 10, fontSize: 13 }}>
              {detail
                ? `${formatDateTime(detail.createdAt)} · ${formatDuration(detail.durationSeconds)}`
                : "Loading"}
            </span>
          </div>
          <button type="button" className="dv-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="dv-modal-body">
          {error ? <p className="dv-empty">{error}</p> : null}

          {detail ? (
            <>
              {detail.playbackUrl ? (
                <audio
                  ref={audioRef}
                  className="dv-audio"
                  controls
                  preload="metadata"
                  src={detail.playbackUrl}
                  onTimeUpdate={onTimeUpdate}
                />
              ) : (
                <p style={{ color: "var(--slate)", fontSize: 13 }}>
                  This call recording isn&apos;t available yet — check back in
                  a few minutes.
                </p>
              )}

              {detail.summary ? (
                <p style={{ fontSize: 13, marginTop: 0 }}>{detail.summary}</p>
              ) : null}

              {utterances.length > 0 ? (
                <div className="dv-transcript">
                  {utterances.map((utterance, index) => (
                    <div
                      key={index}
                      className={`dv-utt${index === activeIndex ? " dv-utt--active" : ""}`}
                      onClick={() => seekTo(utterance)}
                      style={{
                        cursor:
                          utterance.startSeconds !== null ? "pointer" : "default",
                      }}
                    >
                      <div className="dv-utt-role">
                        {utterance.role === "agent" ? "Assistant" : "Caller"}
                      </div>
                      {utterance.content}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--slate)", fontSize: 13 }}>
                  No transcript was captured for this call.
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
