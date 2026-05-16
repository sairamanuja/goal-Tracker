// Notification utilities — gracefully no-ops if env vars are missing
// All functions are fire-and-forget; errors are logged but never thrown.

import { Resend } from "resend";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ─── Email via Resend ─────────────────────────────────────────────────────────

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

// ─── Teams Adaptive Card via Incoming Webhook ────────────────────────────────

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

// ─── Notification helpers ─────────────────────────────────────────────────────

export function goalSubmissionEmail(employeeName: string, cycleName: string) {
  return `
    <p>Hi,</p>
    <p><strong>${employeeName}</strong> has submitted their goal sheet for <strong>${cycleName}</strong> and is awaiting your approval.</p>
    <p><a href="${BASE_URL}/manager/dashboard">Review in GoalTrack →</a></p>
  `;
}

export function goalApprovedEmail(managerName: string, cycleName: string) {
  return `
    <p>Hi,</p>
    <p>Your goal sheet for <strong>${cycleName}</strong> has been approved by <strong>${managerName}</strong>. You can now log quarterly achievements.</p>
    <p><a href="${BASE_URL}/employee/goals">View your goals →</a></p>
  `;
}

export function goalReturnedEmail(managerName: string, comment: string, cycleName: string) {
  return `
    <p>Hi,</p>
    <p>Your goal sheet for <strong>${cycleName}</strong> has been returned by <strong>${managerName}</strong> for revision.</p>
    <blockquote>${comment}</blockquote>
    <p><a href="${BASE_URL}/employee/goals">Review and update your goals →</a></p>
  `;
}

export function quarterOpenEmail(quarterName: string, cycleName: string) {
  return `
    <p>Hi,</p>
    <p><strong>${quarterName}</strong> of <strong>${cycleName}</strong> is now open for achievement logging. Please update your progress.</p>
    <p><a href="${BASE_URL}/employee/goals">Log achievements →</a></p>
  `;
}
