import "dotenv/config";

import { eq } from "drizzle-orm";

import { db, subscriptions, tenants, users } from "../src/db";
import { OVERAGE_RATE_PER_MINUTE_USD, TIER_PRICING } from "../src/lib/pricing";
import { generateSetPasswordToken } from "../src/lib/tokens";

/**
 * Creates (or refreshes) a demo tenant that skips Polar checkout entirely, so
 * the call pipeline — Retell webhook → dashboard → recording → booking emails
 * — can be tested without a completed payment. This is the manual activation
 * docs/06-demo-video-runbook.md calls for.
 *
 * Deliberately a LOCAL SCRIPT, not an admin-panel button: no code path in the
 * deployed app is allowed to mark a tenant active without payment. Activation
 * in production remains the Polar webhook's exclusive job.
 *
 * Usage:
 *   npm run demo:tenant -- owner@example.com          print the login link
 *   npm run demo:tenant -- owner@example.com --send   also email the link
 *   npm run demo:tenant -- --remove                   delete the demo tenant
 *
 * Re-running issues a fresh set-password link, so it doubles as "I lost the
 * link" recovery.
 */

const DEMO_TENANT_ID = "demo-tenant";
const DEMO_SLUG = "demo";
const DEMO_TIER = "pilot" as const;

const DEMO_INTAKE_SCHEMA = {
  bookingIntentField: "is_booking_confirmed",
  fields: [
    { key: "party_size", label: "Party size", type: "number" },
    { key: "order_items", label: "Order items", type: "text" },
    { key: "pickup_or_delivery", label: "Pickup or delivery", type: "text" },
    { key: "preferred_time", label: "Preferred time", type: "text" },
  ],
  customerFieldMap: {
    name: "customer_name",
    email: "customer_email",
    phone: "customer_phone",
  },
};

function baseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

async function remove() {
  await db.delete(users).where(eq(users.tenantId, DEMO_TENANT_ID));
  await db
    .delete(subscriptions)
    .where(eq(subscriptions.tenantId, DEMO_TENANT_ID));
  await db.delete(tenants).where(eq(tenants.id, DEMO_TENANT_ID));
  console.log("Demo tenant removed.");
  console.log(
    "NOTE: any calls/bookings recorded against it must be deleted first if this failed on a foreign-key error.",
  );
}

async function create(ownerEmail: string, sendEmail: boolean) {
  const pricing = TIER_PRICING[DEMO_TIER];
  const now = new Date();

  // Guard: users.email is unique account-wide. Re-pointing an existing
  // account (especially the admin) at the demo tenant would be a nasty
  // surprise, so refuse instead.
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);
  if (existingUser && existingUser.tenantId !== DEMO_TENANT_ID) {
    throw new Error(
      `${ownerEmail} already belongs to another account (role: ${existingUser.role}). ` +
        `Use a different address — Gmail plus-addressing works well, e.g. you+demo@gmail.com.`,
    );
  }

  await db
    .insert(tenants)
    .values({
      id: DEMO_TENANT_ID,
      slug: DEMO_SLUG,
      name: "Saffron Table (Demo)",
      ownerEmail,
      businessType: "restaurant",
      intakeSchema: DEMO_INTAKE_SCHEMA,
      // Manual activation — the whole point of this script.
      status: "active",
      selectedTier: DEMO_TIER,
      polarCustomerReference: null,
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: { ownerEmail, status: "active", selectedTier: DEMO_TIER },
    });

  // A subscription row makes the dashboard's billing card and usage bar
  // render; no Polar objects are involved, so nothing here can be billed.
  await db
    .insert(subscriptions)
    .values({
      tenantId: DEMO_TENANT_ID,
      tier: DEMO_TIER,
      monthlyPriceUsd: pricing.monthlyPriceUsd,
      minuteCap: pricing.minuteCap,
      overageRatePerMinuteUsd: OVERAGE_RATE_PER_MINUTE_USD,
      minutesUsedThisCycle: 0,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing({ target: subscriptions.tenantId });

  const token = generateSetPasswordToken();

  await db
    .insert(users)
    .values({
      tenantId: DEMO_TENANT_ID,
      email: ownerEmail,
      role: "tenant_owner",
      // Only the digest is stored; the raw token lives in the link below.
      setPasswordToken: token.tokenHash,
      setPasswordTokenExpiresAt: token.expiresAt,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        setPasswordToken: token.tokenHash,
        setPasswordTokenExpiresAt: token.expiresAt,
      },
    });

  const link = `${baseUrl()}/set-password?token=${token.rawToken}`;

  if (sendEmail) {
    const { sendSetPasswordEmail } = await import("../src/lib/email");
    await sendSetPasswordEmail({
      to: ownerEmail,
      tenantName: "Saffron Table (Demo)",
      rawToken: token.rawToken,
    });
    console.log(`Set-password email sent to ${ownerEmail}.`);
  }

  console.log("");
  console.log("Demo tenant ready (active, Pilot plan, no payment involved).");
  console.log(`  Owner:     ${ownerEmail}`);
  console.log(`  Dashboard: ${baseUrl()}/org/${DEMO_SLUG}/dashboard`);
  console.log("");
  console.log("Set the password using this single-use link (valid 48h):");
  console.log(`  ${link}`);
  console.log("");
  console.log(
    "Next: paste the Retell agent ID onto this tenant in /admin, then place a test call.",
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--remove")) {
    await remove();
    return;
  }

  const ownerEmail = args
    .find((arg) => !arg.startsWith("--"))
    ?.trim()
    .toLowerCase();
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error(
      "Pass the demo tenant's owner email, e.g.\n" +
        "  npm run demo:tenant -- you+demo@gmail.com",
    );
  }

  await create(ownerEmail, args.includes("--send"));
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
