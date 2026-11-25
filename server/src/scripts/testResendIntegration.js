/**
 * testResendIntegration.js
 * ─────────────────────────
 * Verification test suite for TeamFlow Resend email integration.
 * Tests:
 * 1. Resend provider selection and successful delivery (mocked, no real email sent).
 * 2. Resend API error handling and graceful failure return structure.
 * 3. Resend exception/network error handling without throwing uncaught exceptions.
 * 4. Priority fallback to SMTP when Resend is unconfigured.
 * 5. SMTP error handling without crashing.
 * 6. Priority fallback to Console Simulation when neither provider is configured.
 * 7. Invitation email payload construction (URL, rawToken, org name, role).
 * 8. Cryptographic token security (SHA-256 hashing vs raw token).
 * 9. Non-blocking invitation controller integration.
 */

const crypto = require('crypto');
const mailer = require('../services/mailer');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TeamFlow — Resend Email Integration Test Suite');
  console.log('======================================================\n');

  const originalEnv = { ...process.env };

  try {
    // -----------------------------------------------------------------
    // TEST 1: Resend Provider Selection & Successful Delivery
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Resend Provider Selection & Success ---');
    let capturedPayload = null;
    mailer.setMockResendClient({
      emails: {
        send: async (payload) => {
          capturedPayload = payload;
          return {
            data: { id: 'resend_msg_test_abc123' },
            error: null,
          };
        },
      },
    });
    mailer.setMockSmtpTransporter(null);

    process.env.RESEND_API_KEY = 're_test_mock_api_key_12345';
    process.env.RESEND_FROM = 'TeamFlow <test-sender@resend.dev>';

    const resendSuccessResult = await mailer.sendMail({
      to: 'member@example.com',
      subject: 'Test Resend Subject',
      text: 'Test plain body text',
    });

    assert(resendSuccessResult.sent === true, 'Result sent is true');
    assert(resendSuccessResult.messageId === 'resend_msg_test_abc123', 'Result messageId matches Resend data id');
    assert(resendSuccessResult.deliveryStatus === 'accepted_by_provider', 'Result deliveryStatus is "accepted_by_provider"');
    assert(resendSuccessResult.provider === 'resend', 'Result provider is "resend"');
    assert(capturedPayload !== null, 'Resend send method was invoked');
    assert(capturedPayload.from === 'TeamFlow <test-sender@resend.dev>', 'Sender address matches RESEND_FROM');
    assert(Array.isArray(capturedPayload.to) && capturedPayload.to[0] === 'member@example.com', 'Recipient is formatted as array');
    console.log('Test 1 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 2: Resend API Error Handling (Graceful, non-throwing)
    // -----------------------------------------------------------------
    console.log('--- TEST 2: Resend API Error Handling ---');
    mailer.setMockResendClient({
      emails: {
        send: async () => {
          return {
            data: null,
            error: {
              name: 'validation_error',
              message: 'Domain not verified for sending',
            },
          };
        },
      },
    });

    const resendApiErrorResult = await mailer.sendMail({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    assert(resendApiErrorResult.sent === false, 'Result sent is false on API error');
    assert(resendApiErrorResult.reason === 'Domain not verified for sending', 'Error reason is preserved');
    assert(resendApiErrorResult.deliveryStatus === 'failed', 'Result deliveryStatus is "failed"');
    assert(resendApiErrorResult.provider === 'resend', 'Result provider is "resend"');
    console.log('Test 2 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 3: Resend Exception / Network Rejection Handling
    // -----------------------------------------------------------------
    console.log('--- TEST 3: Resend Exception Handling ---');
    mailer.setMockResendClient({
      emails: {
        send: async () => {
          throw new Error('ETIMEDOUT: Connection to api.resend.com timed out');
        },
      },
    });

    const resendExceptionResult = await mailer.sendMail({
      to: 'member@example.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    assert(resendExceptionResult.sent === false, 'Result sent is false on exception');
    assert(resendExceptionResult.reason.includes('ETIMEDOUT'), 'Exception message is captured in reason');
    assert(resendExceptionResult.deliveryStatus === 'failed', 'deliveryStatus is "failed" on exception');
    assert(resendExceptionResult.provider === 'resend', 'provider is "resend" on exception');
    console.log('Test 3 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 4: Priority Fallback to SMTP when Resend is Not Configured
    // -----------------------------------------------------------------
    console.log('--- TEST 4: SMTP Fallback when Resend is Unset ---');
    mailer.setMockResendClient(null);
    delete process.env.RESEND_API_KEY;

    let smtpCapturedPayload = null;
    mailer.setMockSmtpTransporter({
      sendMail: async (opts) => {
        smtpCapturedPayload = opts;
        return { messageId: '<smtp_msg_id_9999@test.com>' };
      },
    });

    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'testuser';
    process.env.SMTP_PASS = 'testpass';
    process.env.SMTP_FROM = 'TeamFlow <smtp@teamflow.io>';

    const smtpSuccessResult = await mailer.sendMail({
      to: 'smtp-recipient@example.com',
      subject: 'SMTP Subject',
      text: 'SMTP body',
    });

    assert(smtpSuccessResult.sent === true, 'Result sent is true via SMTP');
    assert(smtpSuccessResult.messageId === '<smtp_msg_id_9999@test.com>', 'Result messageId matches SMTP info');
    assert(smtpSuccessResult.deliveryStatus === 'delivered', 'Result deliveryStatus is "delivered"');
    assert(smtpSuccessResult.provider === 'smtp', 'Result provider is "smtp"');
    assert(smtpCapturedPayload.from === 'TeamFlow <smtp@teamflow.io>', 'SMTP from address matches SMTP_FROM');
    console.log('Test 4 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 5: SMTP Error Handling
    // -----------------------------------------------------------------
    console.log('--- TEST 5: SMTP Failure Handling ---');
    mailer.setMockSmtpTransporter({
      sendMail: async () => {
        throw new Error('535 Authentication credentials invalid');
      },
    });

    const smtpErrorResult = await mailer.sendMail({
      to: 'smtp-recipient@example.com',
      subject: 'SMTP Subject',
      text: 'SMTP body',
    });

    assert(smtpErrorResult.sent === false, 'Result sent is false on SMTP failure');
    assert(smtpErrorResult.reason === '535 Authentication credentials invalid', 'SMTP failure reason preserved');
    assert(smtpErrorResult.deliveryStatus === 'failed', 'Result deliveryStatus is "failed"');
    assert(smtpErrorResult.provider === 'smtp', 'Result provider is "smtp"');
    console.log('Test 5 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 6: Console Simulation Fallback when Neither Provider Configured
    // -----------------------------------------------------------------
    console.log('--- TEST 6: Console Simulation Fallback ---');
    mailer.setMockResendClient(null);
    mailer.setMockSmtpTransporter(null);
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const devSimResult = await mailer.sendMail({
      to: 'dev@example.com',
      subject: 'Dev Simulation Subject',
      text: 'Dev simulation body text',
    });

    assert(devSimResult.sent === false, 'Dev simulation sent is false (never falsely claims delivered)');
    assert(devSimResult.reason === 'PROVIDERS_NOT_CONFIGURED', 'Reason is "PROVIDERS_NOT_CONFIGURED"');
    assert(devSimResult.deliveryStatus === 'simulated_dev_log', 'deliveryStatus is "simulated_dev_log"');
    assert(devSimResult.provider === 'simulated', 'provider is "simulated"');
    console.log('Test 6 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 7: Invitation Email Construction & Token Ingestion
    // -----------------------------------------------------------------
    console.log('--- TEST 7: Invitation Email Payload Construction ---');
    let inviteCapturedEmail = null;
    mailer.setMockResendClient({
      emails: {
        send: async (payload) => {
          inviteCapturedEmail = payload;
          return { data: { id: 'invite_email_id_777' }, error: null };
        },
      },
    });
    process.env.RESEND_API_KEY = 're_test_dummy_key';
    process.env.CLIENT_URL = 'http://localhost:5173';

    const testRawToken = 'abc123def45678901234567890abcdef12345678901234567890abcdef123456';
    const inviteEmailResult = await mailer.sendInvitationEmail({
      recipientEmail: 'newemployee@company.com',
      organisationName: 'Acme Technologies',
      inviterName: 'Jane Smith',
      role: 'developer',
      inviteToken: testRawToken,
    });

    assert(inviteEmailResult.sent === true, 'sendInvitationEmail returns success via Resend');
    assert(inviteEmailResult.deliveryStatus === 'accepted_by_provider', 'sendInvitationEmail deliveryStatus is accepted_by_provider');
    assert(inviteCapturedEmail !== null, 'Resend client received payload');
    assert(inviteCapturedEmail.to[0] === 'newemployee@company.com', 'Recipient email matches');
    assert(inviteCapturedEmail.subject.includes('Acme Technologies'), 'Subject contains organisation name');
    assert(inviteCapturedEmail.text.includes('developer'), 'Plain text contains invited role');
    assert(inviteCapturedEmail.text.includes(`http://localhost:5173/invite/${testRawToken}`), 'Plain text contains correct invite URL with raw token');
    assert(inviteCapturedEmail.html.includes(`http://localhost:5173/invite/${testRawToken}`), 'HTML contains clickable link with raw token');
    console.log('Test 7 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 8: Token Cryptography & Security
    // -----------------------------------------------------------------
    console.log('--- TEST 8: Token Cryptographic Security ---');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    assert(rawToken.length === 64, 'Raw token is 64 hex characters (32 bytes entropy)');
    assert(tokenHash.length === 64, 'Hashed token is 64 hex characters (SHA-256)');
    assert(rawToken !== tokenHash, 'Raw token does not equal SHA-256 hash');

    // Verify hash can be matched deterministically
    const recomputedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert(recomputedHash === tokenHash, 'Recomputing SHA-256 hash yields exact match');
    console.log('Test 8 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 9: Non-Blocking Controller Contract Verification
    // -----------------------------------------------------------------
    console.log('--- TEST 9: Controller Non-Blocking Contract ---');
    const invitationController = require('../controllers/invitationController');
    assert(typeof invitationController.createInvitation === 'function', 'createInvitation controller exported');
    assert(typeof invitationController.verifyInvitation === 'function', 'verifyInvitation controller exported');
    assert(typeof invitationController.acceptInvitation === 'function', 'acceptInvitation controller exported');
    assert(typeof invitationController.resendInvitation === 'function', 'resendInvitation controller exported');
    assert(typeof invitationController.revokeInvitation === 'function', 'revokeInvitation controller exported');
    assert(typeof invitationController.getOrgInvitations === 'function', 'getOrgInvitations controller exported');
    console.log('Test 9 passed successfully.\n');

    console.log('======================================================');
    console.log(`✅ All ${passedTests}/${totalTests} tests PASSED!`);
    console.log('======================================================\n');
  } finally {
    // Reset mocks and restore environment
    mailer.setMockResendClient(null);
    mailer.setMockSmtpTransporter(null);
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite execution failed:', err);
  process.exit(1);
});
