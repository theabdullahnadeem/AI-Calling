/**
 * Phone normalization shared by the suppression list writer and the outbound
 * guard — both sides MUST normalize identically or a suppressed number could
 * be missed over a formatting difference. Pure, unit-tested.
 *
 * Output: "+<digits>" (10-15 digits per E.164), with bare 10-digit NANP
 * numbers gaining a +1. Anything unparseable returns null.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) {
    // Bare NANP number without country code.
    return `+1${digits}`;
  }
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}
