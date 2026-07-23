// No `server-only` or module-level DB import here on purpose: tenant.me()
// resolves the brand on every call, and the unit tests exercise that router
// with neither a react-server runtime nor a DATABASE_URL. Both @/db and R2
// are lazy-imported below, only on the partner path — the same idiom
// billing() uses for Polar.
import { eq } from "drizzle-orm";

import { SUPPORT_EMAIL } from "./support";

/**
 * White-label brand resolution (partners v1). A tenant with a partnerId is
 * presented under the PARTNER'S brand everywhere its owner looks — dashboard
 * rail, email display names, support contacts. Digivixo appears nowhere in a
 * partner client's experience; a direct tenant gets the Digivixo defaults.
 */
export type TenantBrand = {
  name: string;
  supportEmail: string;
  /** Short-lived presigned URL for the logo, minted per render — or null. */
  logoUrl: string | null;
  accentColor: string | null;
  isPartner: boolean;
};

export const DIGIVIXO_BRAND: TenantBrand = {
  name: "Digivixo",
  supportEmail: SUPPORT_EMAIL,
  logoUrl: null,
  accentColor: null,
  isPartner: false,
};

export async function getTenantBrand(tenant: {
  partnerId: string | null;
}): Promise<TenantBrand> {
  if (!tenant.partnerId) return DIGIVIXO_BRAND;

  const { db, partners } = await import("@/db");
  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, tenant.partnerId))
    .limit(1);
  // A dangling partnerId shouldn't render a broken brand — fall back.
  if (!partner) return DIGIVIXO_BRAND;

  let logoUrl: string | null = null;
  if (partner.logoKey) {
    try {
      const { getPartnerLogoUrl } = await import("./r2");
      logoUrl = await getPartnerLogoUrl(partner.logoKey);
    } catch (error) {
      // Branding must never take a dashboard down — log and render text.
      console.error("[branding] logo presign failed:", error);
    }
  }

  return {
    name: partner.name,
    supportEmail: partner.supportEmail,
    logoUrl,
    accentColor: partner.accentColor,
    isPartner: true,
  };
}

/**
 * Email-side brand lookup: display name only (emails embed no presigned
 * URLs — they outlive any expiry we could pick).
 */
export async function getTenantBrandName(tenant: {
  partnerId: string | null;
}): Promise<string | null> {
  if (!tenant.partnerId) return null;
  const { db, partners } = await import("@/db");
  const [partner] = await db
    .select({ name: partners.name })
    .from(partners)
    .where(eq(partners.id, tenant.partnerId))
    .limit(1);
  return partner?.name ?? null;
}
