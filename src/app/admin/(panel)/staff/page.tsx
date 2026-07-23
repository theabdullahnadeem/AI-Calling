import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db, users } from "@/db";
import { requireSuperAdminPage } from "@/lib/admin-guard";
import { CreateStaffForm } from "./create-staff-form";
import { StaffRowActions } from "./staff-row-actions";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

type InviteStatus = "active" | "invite_pending" | "invite_expired";

function inviteStatus(row: {
  passwordHash: string | null;
  setPasswordTokenExpiresAt: Date | null;
}): InviteStatus {
  if (row.passwordHash) return "active";
  if (
    row.setPasswordTokenExpiresAt &&
    row.setPasswordTokenExpiresAt.getTime() > Date.now()
  ) {
    return "invite_pending";
  }
  return "invite_expired";
}

const STATUS_LABELS: Record<InviteStatus, { label: string; color: string }> = {
  active: { label: "active", color: "var(--signal)" },
  invite_pending: { label: "invite pending", color: "var(--slate)" },
  invite_expired: { label: "invite expired", color: "var(--alert)" },
};

/**
 * Staff account management — SUPER-ADMIN ONLY (the middleware 404s staff
 * sessions before this renders; the guard below is the server-side
 * authority). Staff admins run tenant onboarding but never see dollar
 * amounts, invoices, or this page.
 */
export default async function StaffPage() {
  await requireSuperAdminPage();

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.role, "staff_admin"))
    .orderBy(desc(users.createdAt));

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/admin" style={{ color: "var(--slate)", fontSize: 13 }}>
          ← All tenants
        </Link>
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Staff accounts</h1>
      <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 24px" }}>
        Staff admins can create tenants, send payment links, map agents, and
        set intake schemas. They never see dollar amounts, invoices, or this
        page.
      </p>

      <div style={{ overflowX: "auto", marginBottom: 48 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 6,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--slate)" }}>
              {["Email", "Status", "Created", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--line)",
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: "24px 12px", color: "var(--slate)" }}
                >
                  No staff accounts yet — invite the first one below.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const status = inviteStatus(u);
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: "1px solid var(--line-soft)" }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          color: STATUS_LABELS[status].color,
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_LABELS[status].label}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--slate)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDate(u.createdAt)}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <StaffRowActions
                        staffId={u.id}
                        email={u.email}
                        isActive={status === "active"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>Invite staff admin</h2>
      <CreateStaffForm />
    </>
  );
}
