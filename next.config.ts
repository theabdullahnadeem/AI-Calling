import type { NextConfig } from "next";

// Baseline hardening on every response. A strict CSP is deliberately
// deferred: it needs per-request nonces wired through the app shell to avoid
// breaking Next's inline runtime — tracked for a later hardening pass.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // ws (the Neon Pool's WebSocket transport) must stay a real node_modules
  // require: bundling it shims its optional native deps (bufferutil) into
  // broken stubs and every DB query dies with "bufferUtil.mask is not a
  // function".
  serverExternalPackages: ["ws"],
  experimental: {
    // Enables forbidden() in server components (the /org layout's 403 path).
    authInterrupts: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
