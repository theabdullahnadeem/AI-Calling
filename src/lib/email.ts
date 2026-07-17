import "server-only";

import { Resend } from "resend";

import { serverEnv } from "./env";

function resendClient(): Resend {
  return new Resend(serverEnv("RESEND_API_KEY"));
}

/** Admin-entered values are interpolated into HTML — always escape them. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const wrapper = (body: string) => `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #161B22;">
    ${body}
    <p style="margin-top: 40px; font-size: 12px; color: #5B6472;">Digivixo — managed voice AI for your business line.</p>
  </div>
`;

export async function sendSetPasswordEmail(params: {
  to: string;
  tenantName: string;
  rawToken: string;
}): Promise<void> {
  // Raw token only ever exists in this link — never logged, never stored.
  const link = `${serverEnv("APP_URL")}/set-password?token=${params.rawToken}`;
  await resendClient().emails.send({
    from: serverEnv("EMAIL_FROM"),
    to: params.to,
    subject: "Set your Digivixo dashboard password",
    html: wrapper(`
      <h2 style="font-size: 20px; margin: 0 0 16px;">Your dashboard is ready</h2>
      <p>Payment for <strong>${escapeHtml(params.tenantName)}</strong> is confirmed. Set a password to access your call dashboard:</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background: #1F6F5C; color: #FAFAF8; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Set your password</a>
      </p>
      <p style="font-size: 13px; color: #5B6472;">This link expires in 48 hours and can be used once. If it expires, contact us and we'll send a fresh one.</p>
    `),
  });
}

export async function sendPaymentLinkEmail(params: {
  to: string;
  tenantName: string;
  tierLabel: string;
  checkoutUrl: string;
}): Promise<void> {
  await resendClient().emails.send({
    from: serverEnv("EMAIL_FROM"),
    to: params.to,
    subject: `Digivixo — complete your ${escapeHtml(params.tierLabel)} subscription`,
    html: wrapper(`
      <h2 style="font-size: 20px; margin: 0 0 16px;">Complete your subscription</h2>
      <p>Here is the secure checkout link for <strong>${escapeHtml(params.tenantName)}</strong> (${escapeHtml(params.tierLabel)} plan):</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(params.checkoutUrl)}" style="background: #1F6F5C; color: #FAFAF8; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Complete payment</a>
      </p>
      <p style="font-size: 13px; color: #5B6472;">Once payment is confirmed you'll automatically receive a separate email to set up your dashboard access.</p>
    `),
  });
}
