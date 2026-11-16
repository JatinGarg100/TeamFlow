const nodemailer = require('nodemailer');

/**
 * mailer.js
 * ─────────
 * Email notification service for TeamFlow.
 * Handles task assignment alerts and workspace invitation emails.
 *
 * Rules:
 * - Uses SMTP configuration from environment variables.
 * - If SMTP configuration is missing, safely logs to the development console
 *   and reports delivery was not attempted (never falsely claiming sent).
 * - Non-blocking: catches failures so task creation or invites are never rolled back
 *   solely because of an external email provider outage.
 */

// Helper to determine if real SMTP credentials are provided
const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

// Create reusable Nodemailer transporter when credentials exist
let transporter = null;
if (isSmtpConfigured()) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch (err) {
    console.warn('[Mailer] Could not initialize SMTP transporter:', err.message);
  }
}

/**
 * Send an email message.
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Subject line
 * @param {string} options.text - Plain text content
 * @param {string} [options.html] - Optional HTML formatted content
 * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
 */
const sendMail = async ({ to, subject, text, html }) => {
  const from = process.env.SMTP_FROM || 'TeamFlow <notifications@teamflow.io>';

  if (!isSmtpConfigured() || !transporter) {
    console.log('\n--------------------------------------------------------------');
    console.log('📨 [TeamFlow Mailer (Dev Mode - Delivery Not Attempted)]');
    console.log(`To:      ${to}`);
    console.log(`From:    ${from}`);
    console.log(`Subject: ${subject}`);
    console.log('Body:');
    console.log(text);
    console.log('--------------------------------------------------------------\n');

    return {
      sent: false,
      reason: 'SMTP_NOT_CONFIGURED',
      deliveryStatus: 'simulated_dev_log',
    };
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br />'),
    });

    console.log(`[Mailer] Email sent successfully to ${to} (MessageId: ${info.messageId})`);
    return {
      sent: true,
      messageId: info.messageId,
      deliveryStatus: 'delivered',
    };
  } catch (error) {
    console.error(`[Mailer] Failed to send email to ${to}:`, error.message);
    return {
      sent: false,
      reason: error.message,
      deliveryStatus: 'failed',
    };
  }
};

/**
 * Send task assignment notification to an employee.
 */
const sendTaskAssignmentEmail = async ({
  recipientEmail,
  recipientName,
  taskTitle,
  projectName,
  taskDescription = '',
  dueDate = null,
  priority = 'Medium',
  taskId,
  projectId,
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const taskUrl = `${clientUrl}/projects/${projectId}?task=${taskId}`;
  const formattedDueDate = dueDate ? new Date(dueDate).toISOString().split('T')[0] : 'None set';

  const subject = `New task assigned to you — ${taskTitle}`;

  const text = `Hello ${recipientName || 'Team Member'},

You have been assigned to the following task in TeamFlow:

Project:     ${projectName}
Task:        ${taskTitle}
Priority:    ${priority}
Due Date:    ${formattedDueDate}
${taskDescription ? `Description: ${taskDescription}\n` : ''}
Please log in to TeamFlow to view the task and update its status as you work.

Open Task: ${taskUrl}

Regards,
TeamFlow`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; color: #1E202A;">
  <div style="border-bottom: 2px solid #5B4BDB; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #5B4BDB; margin: 0; font-size: 20px;">TeamFlow</h2>
  </div>

  <p style="font-size: 15px; margin-bottom: 16px;">Hello <strong>${recipientName || 'Team Member'}</strong>,</p>

  <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">You have been assigned to the following task:</p>

  <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 6px 0; font-size: 14px;"><strong>Project:</strong> ${projectName}</p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Task:</strong> ${taskTitle}</p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Priority:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; background: #EEEDFD; color: #5B4BDB; font-weight: 600;">${priority}</span></p>
    <p style="margin: 6px 0; font-size: 14px;"><strong>Due Date:</strong> ${formattedDueDate}</p>
    ${taskDescription ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Description:</strong> ${taskDescription}</p>` : ''}
  </div>

  <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">Please log in to TeamFlow to view the task and update its status as you make progress.</p>

  <div style="margin-bottom: 24px;">
    <a href="${taskUrl}" style="background-color: #5B4BDB; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">Open Task in TeamFlow</a>
  </div>

  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #94A3B8; margin: 0;">Regards,<br /><strong>TeamFlow SaaS</strong></p>
</div>`;

  return sendMail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
};

/**
 * Send workspace invitation email to a prospective employee.
 */
const sendInvitationEmail = async ({
  recipientEmail,
  organisationName,
  inviterName,
  role,
  inviteToken,
}) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const inviteUrl = `${clientUrl}/invite/${inviteToken}`;

  const subject = `You're invited to join ${organisationName} on TeamFlow`;

  const text = `Hello,

${inviterName || 'An administrator'} has invited you to join the ${organisationName} workspace on TeamFlow with the role of "${role}".

TeamFlow is a project and task coordination platform.

To accept your invitation and set up your account, click the link below:

Accept Invitation: ${inviteUrl}

This invitation link will expire in 7 days.

Regards,
TeamFlow`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; color: #1E202A;">
  <div style="border-bottom: 2px solid #5B4BDB; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #5B4BDB; margin: 0; font-size: 20px;">TeamFlow</h2>
  </div>

  <p style="font-size: 15px; margin-bottom: 16px;">Hello,</p>

  <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
    <strong>${inviterName || 'An administrator'}</strong> has invited you to join <strong>${organisationName}</strong> on TeamFlow as a <strong>${role}</strong>.
  </p>

  <div style="margin-bottom: 24px;">
    <a href="${inviteUrl}" style="background-color: #5B4BDB; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; display: inline-block;">Accept Invitation &amp; Join Workspace</a>
  </div>

  <p style="font-size: 12px; color: #64748B;">This invitation link will expire in 7 days.</p>

  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #94A3B8; margin: 0;">Regards,<br /><strong>TeamFlow SaaS</strong></p>
</div>`;

  return sendMail({
    to: recipientEmail,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendMail,
  sendTaskAssignmentEmail,
  sendInvitationEmail,
};
