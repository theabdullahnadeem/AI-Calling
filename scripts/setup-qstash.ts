import "dotenv/config";

import { Client } from "@upstash/qstash";

/**
 * Registers (or updates) the QStash schedules that drive this app's
 * background jobs. Idempotent: stable scheduleIds mean re-running overwrites
 * instead of duplicating.
 *
 * Usage: set QSTASH_TOKEN and APP_URL in .env, then `npm run qstash:setup`.
 * Run it once per environment (again if APP_URL ever changes). Prompt 6's
 * daily grace-period suspension job will be added here.
 */
async function main() {
  const token = process.env.QSTASH_TOKEN;
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");

  if (!token || !appUrl) {
    throw new Error("Set QSTASH_TOKEN and APP_URL in .env first.");
  }
  if (appUrl.includes("localhost")) {
    throw new Error(
      "APP_URL points at localhost — QStash can only deliver to a public URL.",
    );
  }

  const client = new Client({ token });

  const schedules = [
    {
      scheduleId: "digivixo-email-retry",
      destination: `${appUrl}/api/jobs/email-retry`,
      cron: "*/15 * * * *",
    },
    {
      // Daily 3-day-grace-window check (Prompt 6): suspends tenants whose
      // payment has been overdue for more than 3 days.
      scheduleId: "digivixo-billing-suspend",
      destination: `${appUrl}/api/jobs/billing-suspend`,
      cron: "0 3 * * *",
    },
  ];

  for (const schedule of schedules) {
    await client.schedules.create(schedule);
    console.log(
      `Scheduled ${schedule.scheduleId}: ${schedule.cron} → ${schedule.destination}`,
    );
  }
}

// No process.exit() here: forcing exit while fetch's keep-alive sockets are
// still closing triggers a libuv assertion crash on Windows (async.c:94).
// Letting the event loop drain exits cleanly a few seconds later.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
