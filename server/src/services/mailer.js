const nodemailer = require('nodemailer');
const { Resend } = require('resend');

/**
 * mailer.js
 * ─────────
 * Email notification service for TeamFlow.
 * Handles task assignment alerts and workspace invitation emails.
 *
 * Delivery Priority:
 * 1. Resend when RESEND_API_KEY is configured.
 * 2. SMTP / Nodemailer when SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) are configured.
 * 3. Development console simulation fallback when neither provider is configured.
 *
 * Rules:
 * - Non-blocking: failures never break or roll back business transactions (e.g. invitation creation).
 * - Security: API keys and raw authentication tokens are never leaked to logs.
 * - Consistent return structure across all delivery channels.
 */

// Track cached client instances to avoid repeated instantiation overhead
let resendInstance = null;
let lastResendKey = null;
let smtpTransporter = null;
let lastSmtpConfig = null;

// Mock hooks for deterministic automated testing
let mockResendClient = null;
let mockSmtpTransporter = null;

/**
 * Check if Resend email service is configured
 */
const isResendConfigured = () => {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
};

/**
 * Check if SMTP credentials are provided
 */
const isSmtpConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

/**
 * Get or initialize Resend client instance
 */
const getResendClient = () => {
  if (mockResendClient) {
    return mockResendClient;
  }
  const apiKey = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : '';
  if (!apiKey) return null;

  if (resendInstance && lastResendKey === apiKey) {
    return resendInstance;
  }

  try {
    resendInstance = new Resend(apiKey);
    lastResendKey = apiKey;
    return resendInstance;
  } catch (err) {
    console.error('[Mailer] Could not initialize Resend client:', err.message);
    return null;
  }
};

/**
 * Get or initialize SMTP transporter
 */
const getSmtpTransporter = () => {
  if (mockSmtpTransporter) {
    return mockSmtpTransporter;
  }
  if (!isSmtpConfigured()) return null;

  const configSignature = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`;
  if (smtpTransporter && lastSmtpConfig === configSignature) {
    return smtpTransporter;
  }

  try {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    lastSmtpConfig = configSignature;
    return smtpTransporter;
  } catch (err) {
    console.warn('[Mailer] Could not initialize SMTP transporter:', err.message);
    return null;
  }
};

/**
 * Set mock Resend client for unit testing
 */
const setMockResendClient = (mockClient) => {
  mockResendClient = mockClient;
  if (!mockClient) {
    resendInstance = null;
    lastResendKey = null;
  }
};

/**
 * Set mock SMTP transporter for unit testing
 */
const setMockSmtpTransporter = (mockTransporter) => {
  mockSmtpTransporter = mockTransporter;
  if (!mockTransporter) {
    smtpTransporter = null;
    lastSmtpConfig = null;
  }
};

/**
 * Send an email message using priority delivery (Resend -> SMTP -> Dev Simulation).
 *
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Subject line
 * @param {string} options.text - Plain text content
 * @param {string} [options.html] - Optional HTML formatted content
 * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string, deliveryStatus: string, provider: string }>}
 */
const sendMail = async ({ to, subject, text, html }) => {
  // PRIORITY 1: Resend (when RESEND_API_KEY is configured or mock client is provided)
  if (isResendConfigured() || mockResendClient) {
    const resend = getResendClient();
    const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'TeamFlow <onboarding@resend.dev>';

    if (resend) {
      try {
        const payload = {
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          text,
          html: html || (text ? text.replace(/\n/g, '<br />') : undefined),
        };

        const response = await resend.emails.send(payload);
        const { data, error } = response || {};

        if (error) {
          console.error(`[Mailer] Resend API error sending email to ${to}:`, error.message || error);
          return {
            sent: false,
            reason: error.message || 'Resend API error',
            deliveryStatus: 'failed',
            provider: 'resend',
          };
        }

        const messageId = data?.id || 'unknown';
        console.log(`[Mailer] Email accepted by Resend provider for ${to} (MessageId: ${messageId})`);
        return {
          sent: true,
          messageId,
          deliveryStatus: 'accepted_by_provider',
          provider: 'resend',
        };
      } catch (err) {
        console.error(`[Mailer] Resend request exception for ${to}:`, err.message);
        return {
          sent: false,
          reason: err.message,
          deliveryStatus: 'failed',
          provider: 'resend',
        };
      }
    }
  }

  // PRIORITY 2: SMTP / Nodemailer (when SMTP configuration exists or mock transporter is provided)
  if (isSmtpConfigured() || mockSmtpTransporter) {
    const transporter = getSmtpTransporter();
    const from = process.env.SMTP_FROM || 'TeamFlow <notifications@teamflow.io>';

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from,
          to,
          subject,
          text,
          html: html || (text ? text.replace(/\n/g, '<br />') : undefined),
        });

        console.log(`[Mailer] Email sent successfully via SMTP to ${to} (MessageId: ${info.messageId})`);
        return {
          sent: true,
          messageId: info.messageId,
          deliveryStatus: 'delivered',
          provider: 'smtp',
        };
      } catch (error) {
        console.error(`[Mailer] Failed to send email via SMTP to ${to}:`, error.message);
        return {
          sent: false,
          reason: error.message,
          deliveryStatus: 'failed',
          provider: 'smtp',
        };
      }
    }
  }

  // PRIORITY 3: Development Console Simulation Fallback
  const fallbackFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM || 'TeamFlow <onboarding@resend.dev>';

  console.log('\n--------------------------------------------------------------');
  console.log('📨 [TeamFlow Mailer (Dev Mode - Delivery Not Attempted)]');
  console.log(`To:      ${to}`);
  console.log(`From:    ${fallbackFrom}`);
  console.log(`Subject: ${subject}`);
  console.log('Body:');
  console.log(text);
  console.log('--------------------------------------------------------------\n');

  return {
    sent: false,
    reason: 'PROVIDERS_NOT_CONFIGURED',
    deliveryStatus: 'simulated_dev_log',
    provider: 'simulated',
  };
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
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const cleanBaseUrl = frontendUrl.replace(/\/+$/, '');
  const inviteUrl = `${cleanBaseUrl}/invite/${inviteToken}`;

  const subject = `You've been invited to join ${organisationName} on TeamFlow`;

  const text = `Hello,

${inviterName || 'An administrator'} has invited you to join ${organisationName} on TeamFlow as a ${role}.

Click the button below to accept the invitation and join the workspace:

${inviteUrl}

This invitation expires in 7 days.

If you were not expecting this invitation, you can ignore this email.

Regards,
TeamFlow Team`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #E2E8F0; border-radius: 16px; background-color: #FFFFFF; color: #0F172A;">
  <div style="border-bottom: 2px solid #2563EB; padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: center;">
    <h2 style="color: #2563EB; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">TeamFlow</h2>
  </div>

  <p style="font-size: 15px; font-weight: 600; color: #0F172A; margin-bottom: 14px;">Hello,</p>

  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
    <strong>${inviterName || 'An administrator'}</strong> has invited you to join <strong>${organisationName}</strong> on TeamFlow as a <strong>${role}</strong>.
  </p>

  <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">
    Click the button below to accept the invitation and join the workspace:
  </p>

  <div style="margin-bottom: 28px;">
    <a href="${inviteUrl}" style="background-color: #2563EB; color: #ffffff; padding: 13px 26px; border-radius: 10px; text-decoration: none; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">Accept Invitation</a>
  </div>

  <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 24px;">
    <p style="font-size: 12px; color: #64748B; margin: 0 0 6px 0;">If the button above does not work, copy and paste this link into your browser:</p>
    <a href="${inviteUrl}" style="font-size: 11px; color: #2563EB; word-break: break-all;">${inviteUrl}</a>
  </div>

  <p style="font-size: 12px; color: #64748B; margin-bottom: 8px;">
    This invitation expires in 7 days.
  </p>
  <p style="font-size: 12px; color: #94A3B8; margin-bottom: 24px;">
    If you were not expecting this invitation, you can ignore this email.
  </p>

  <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
  <p style="font-size: 12px; color: #64748B; margin: 0;">
    Regards,<br />
    <strong style="color: #0F172A;">TeamFlow Team</strong>
  </p>
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
  isResendConfigured,
  isSmtpConfigured,
  getResendClient,
  setMockResendClient,
  setMockSmtpTransporter,
};
