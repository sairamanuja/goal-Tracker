// Notification utilities. Integrations gracefully no-op if env vars are missing.
// Errors are logged but never thrown.

import { Resend } from "resend";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmailNotification(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from = process.env.RESEND_FROM ?? "GoalTrack <onboarding@resend.dev>";

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to, subject, html: htmlBody });
  } catch (e) {
    console.error("[notifications] email failed:", e);
  }
}

export async function sendTeamsNotification(
  _userEmail: string,
  message: string,
  deepLink: string
): Promise<void> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const card = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                text: "GoalTrack",
                weight: "Bolder",
                size: "Medium",
              },
              {
                type: "TextBlock",
                text: message,
                wrap: true,
              },
            ],
            actions: [
              {
                type: "Action.OpenUrl",
                title: "Open in GoalTrack",
                url: `${BASE_URL}${deepLink}`,
              },
            ],
          },
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
  } catch (e) {
    console.error("[notifications] Teams failed:", e);
  }
}

export function goalSubmissionEmail(employeeName: string, cycleName: string) {
  const safeEmployeeName = escapeHtml(employeeName);
  const safeCycleName = escapeHtml(cycleName);
  return `
    <p>Hi,</p>
    <p><strong>${safeEmployeeName}</strong> has submitted their goal sheet for <strong>${safeCycleName}</strong> and is awaiting your approval.</p>
    <p><a href="${BASE_URL}/manager/dashboard">Review in GoalTrack -></a></p>
  `;
}

export function goalApprovedEmail(managerName: string, cycleName: string) {
  const safeManagerName = escapeHtml(managerName);
  const safeCycleName = escapeHtml(cycleName);
  return `
    <p>Hi,</p>
    <p>Your goal sheet for <strong>${safeCycleName}</strong> has been approved by <strong>${safeManagerName}</strong>. You can now log quarterly achievements.</p>
    <p><a href="${BASE_URL}/employee/goals">View your goals -></a></p>
  `;
}

export function goalReturnedEmail(managerName: string, comment: string, cycleName: string) {
  const safeManagerName = escapeHtml(managerName);
  const safeComment = escapeHtml(comment);
  const safeCycleName = escapeHtml(cycleName);
  return `
    <p>Hi,</p>
    <p>Your goal sheet for <strong>${safeCycleName}</strong> has been returned by <strong>${safeManagerName}</strong> for revision.</p>
    <blockquote>${safeComment}</blockquote>
    <p><a href="${BASE_URL}/employee/goals">Review and update your goals -></a></p>
  `;
}

export function quarterOpenEmail(quarterName: string, cycleName: string) {
  const safeQuarterName = escapeHtml(quarterName);
  const safeCycleName = escapeHtml(cycleName);
  return `
    <p>Hi,</p>
    <p><strong>${safeQuarterName}</strong> of <strong>${safeCycleName}</strong> is now open for achievement logging. Please update your progress.</p>
    <p><a href="${BASE_URL}/employee/goals">Log achievements -></a></p>
  `;
}
