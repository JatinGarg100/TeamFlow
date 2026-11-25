/**
 * testGoogleAuthIntegration.js
 * ─────────────────────────────
 * Comprehensive verification test suite for TeamFlow Google OAuth integration.
 * Tests:
 * 1. Controller and route exports.
 * 2. Missing ID token / credential handling (400 Bad Request).
 * 3. Unconfigured server handling (503 Service Unavailable).
 * 4. Invalid or expired token handling (401 Unauthorized).
 * 5. Unverified Google email handling (400 Bad Request).
 * 6. User schema structure (googleId sparse index, authProvider enum, optional passwordHash, avatar).
 * 7. Mock end-to-end new Google user registration (User + Workspace + Owner Membership).
 * 8. Mock end-to-end existing Google user sign-in (no duplicate created).
 * 9. Mock end-to-end account linking (links googleId to existing local email without altering passwordHash).
 * 10. Frontend API and Component contract verification.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { OAuth2Client } = require('google-auth-library');
const { User, Organisation, Membership } = require('../models');
const { googleAuth } = require('../controllers/authController');
const fs = require('fs');

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

// Helper to simulate Express req, res, next
function createMockHttp(body = {}) {
  const req = {
    body,
    cookies: {},
  };

  const res = {
    statusCode: 200,
    headers: {},
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
  };

  const next = (err) => {
    if (err) {
      res.statusCode = 500;
      res.jsonData = { success: false, error: { message: err.message } };
    }
  };

  return { req, res, next };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TeamFlow — Google OAuth Integration Test Suite');
  console.log('======================================================\n');

  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Controller & Route Exports
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Controller & Route Verification ---');
    assert(typeof googleAuth === 'function', 'googleAuth controller is an exported function');

    const authRoutesPath = path.join(__dirname, '../routes/authRoutes.js');
    const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');
    assert(authRoutesContent.includes("router.post('/google', googleAuth)"), 'POST /api/auth/google is registered in authRoutes');
    console.log('Test 1 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 2: Missing Token Validation
    // -----------------------------------------------------------------
    console.log('--- TEST 2: Missing Token Validation ---');
    const mockHttpEmpty = createMockHttp({});
    await googleAuth(mockHttpEmpty.req, mockHttpEmpty.res, mockHttpEmpty.next);

    assert(mockHttpEmpty.res.statusCode === 400, 'Empty body returns 400 Bad Request');
    assert(mockHttpEmpty.res.jsonData.success === false, 'Response has success: false');
    assert(
      mockHttpEmpty.res.jsonData.error.message.includes('required'),
      'Error message states token is required'
    );
    console.log('Test 2 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 3: Unconfigured Server (Missing GOOGLE_CLIENT_ID)
    // -----------------------------------------------------------------
    console.log('--- TEST 3: Unconfigured Server (Missing GOOGLE_CLIENT_ID) ---');
    delete process.env.GOOGLE_CLIENT_ID;

    const mockHttpUnconfigured = createMockHttp({ idToken: 'some_sample_token' });
    await googleAuth(mockHttpUnconfigured.req, mockHttpUnconfigured.res, mockHttpUnconfigured.next);

    assert(mockHttpUnconfigured.res.statusCode === 503, 'Unconfigured server returns 503 Service Unavailable');
    assert(mockHttpUnconfigured.res.jsonData.success === false, 'Response has success: false');
    assert(
      mockHttpUnconfigured.res.jsonData.error.message.includes('not configured'),
      'Helpful message about GOOGLE_CLIENT_ID'
    );
    console.log('Test 3 passed successfully.\n');

    // Restore GOOGLE_CLIENT_ID for subsequent tests
    process.env.GOOGLE_CLIENT_ID = 'test-client-id-123456789.apps.googleusercontent.com';

    // -----------------------------------------------------------------
    // TEST 4: Invalid Token Handling
    // -----------------------------------------------------------------
    console.log('--- TEST 4: Invalid Token Handling ---');
    const mockHttpInvalidToken = createMockHttp({ idToken: 'invalid.jwt.token' });
    await googleAuth(mockHttpInvalidToken.req, mockHttpInvalidToken.res, mockHttpInvalidToken.next);

    assert(mockHttpInvalidToken.res.statusCode === 401, 'Invalid token returns 401 Unauthorized');
    assert(mockHttpInvalidToken.res.jsonData.success === false, 'Response has success: false');
    assert(
      mockHttpInvalidToken.res.jsonData.error.message.toLowerCase().includes('token') ||
      mockHttpInvalidToken.res.jsonData.error.message.toLowerCase().includes('invalid'),
      'Error message identifies token error'
    );
    console.log('Test 4 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 5: User Schema Verification
    // -----------------------------------------------------------------
    console.log('--- TEST 5: User Schema Structure Verification ---');
    const schemaPaths = User.schema.paths;

    assert(schemaPaths.googleId !== undefined, 'User schema has googleId path');
    assert(schemaPaths.googleId.options.sparse === true, 'googleId is defined as sparse');
    assert(schemaPaths.googleId.options.unique === true, 'googleId is defined as unique');
    assert(schemaPaths.authProvider !== undefined, 'User schema has authProvider path');
    assert(
      JSON.stringify(schemaPaths.authProvider.options.enum) === JSON.stringify(['local', 'google']),
      'authProvider has enum ["local", "google"]'
    );
    assert(schemaPaths.avatar !== undefined, 'User schema has avatar path');
    assert(schemaPaths.passwordHash.isRequired === false, 'passwordHash is not strictly required in schema');
    console.log('Test 5 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 6: Mock Token Verification - Unverified Google Email
    // -----------------------------------------------------------------
    console.log('--- TEST 6: Unverified Google Email Handling ---');
    const origVerify = OAuth2Client.prototype.verifyIdToken;

    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          sub: 'google-sub-unverified',
          email: 'unverified@example.com',
          email_verified: false,
          name: 'Unverified User',
        }),
      };
    };

    const mockHttpUnverified = createMockHttp({ idToken: 'mock.valid.token' });
    await googleAuth(mockHttpUnverified.req, mockHttpUnverified.res, mockHttpUnverified.next);

    assert(mockHttpUnverified.res.statusCode === 400, 'Unverified email returns 400 Bad Request');
    assert(
      mockHttpUnverified.res.jsonData.error.message.includes('not verified'),
      'Identifies email as unverified'
    );
    console.log('Test 6 passed successfully.\n');

    // -----------------------------------------------------------------
    // TEST 7: Mock End-to-End New User Registration via Google
    // -----------------------------------------------------------------
    console.log('--- TEST 7: Mock End-to-End New Google User Registration ---');
    const testGoogleSub = 'google-sub-' + Date.now();
    const testGoogleEmail = `googleuser.${Date.now()}@teamflow-test.io`;
    const testGoogleName = 'Devon Google';
    const testPicture = 'https://lh3.googleusercontent.com/test-avatar.jpg';

    OAuth2Client.prototype.verifyIdToken = async function () {
      return {
        getPayload: () => ({
          sub: testGoogleSub,
          email: testGoogleEmail,
          email_verified: true,
          name: testGoogleName,
          picture: testPicture,
        }),
      };
    };

    // Check if MongoDB is connected for database tests
    const net = require('net');
    const mongoose = require('mongoose');

    const checkMongoSocket = () => {
      return new Promise((resolve) => {
        const socket = net.createConnection(27017, '127.0.0.1');
        socket.setTimeout(800);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
      });
    };

    let isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected && (await checkMongoSocket())) {
      try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/teamflow', {
          serverSelectionTimeoutMS: 1500,
        });
        isDbConnected = true;
      } catch (err) {
        console.log('  [Notice] MongoDB connection skipped:', err.message);
      }
    }

    if (isDbConnected) {
      const mockHttpNewUser = createMockHttp({
        idToken: 'mock.newuser.token',
        organisationName: 'Devon Innovators',
      });

      await googleAuth(mockHttpNewUser.req, mockHttpNewUser.res, mockHttpNewUser.next);

      assert(mockHttpNewUser.res.statusCode === 201, 'New user returns 201 Created');
      assert(mockHttpNewUser.res.jsonData.success === true, 'Response success is true');
      assert(mockHttpNewUser.res.jsonData.user.email === testGoogleEmail, 'User email matches Google profile');
      assert(mockHttpNewUser.res.jsonData.user.name === testGoogleName, 'User name matches Google profile');
      assert(mockHttpNewUser.res.jsonData.user.authProvider === 'google', 'User authProvider is google');
      assert(mockHttpNewUser.res.jsonData.organisation.role === 'owner', 'User has owner role on workspace');
      assert(Boolean(mockHttpNewUser.res.cookies.token), 'Auth cookie was set');

      // -----------------------------------------------------------------
      // TEST 8: Mock Existing Google User Login (No Duplicates)
      // -----------------------------------------------------------------
      console.log('\n--- TEST 8: Mock Existing Google User Sign-In ---');
      const mockHttpExistingGoogle = createMockHttp({ idToken: 'mock.existing.token' });
      await googleAuth(mockHttpExistingGoogle.req, mockHttpExistingGoogle.res, mockHttpExistingGoogle.next);

      assert(mockHttpExistingGoogle.res.statusCode === 200, 'Existing user returns 200 OK');
      assert(
        mockHttpExistingGoogle.res.jsonData.user.id.toString() === mockHttpNewUser.res.jsonData.user.id.toString(),
        'Returns existing user ID without creating duplicate'
      );

      // Verify DB count for this email is exactly 1
      const count = await User.countDocuments({ email: testGoogleEmail });
      assert(count === 1, 'Exactly one user document exists in MongoDB');

      // -----------------------------------------------------------------
      // TEST 9: Mock Account Linking (Existing Local User)
      // -----------------------------------------------------------------
      console.log('\n--- TEST 9: Mock Account Linking with Existing Email ---');
      const localEmail = `localuser.${Date.now()}@teamflow-test.io`;
      const localPasswordHash = '$2a$10$fakeHashedPasswordForAccountLinkingTest123';
      const localUser = await User.create({
        name: 'Local Member',
        email: localEmail,
        passwordHash: localPasswordHash,
        authProvider: 'local',
      });

      const localGoogleSub = 'google-sub-linked-' + Date.now();
      OAuth2Client.prototype.verifyIdToken = async function () {
        return {
          getPayload: () => ({
            sub: localGoogleSub,
            email: localEmail,
            email_verified: true,
            name: 'Local Member Updated',
            picture: 'https://lh3.googleusercontent.com/avatar-linked.jpg',
          }),
        };
      };

      const mockHttpLink = createMockHttp({ idToken: 'mock.linking.token' });
      await googleAuth(mockHttpLink.req, mockHttpLink.res, mockHttpLink.next);

      assert(mockHttpLink.res.statusCode === 200, 'Account linking returns 200 OK');
      assert(
        mockHttpLink.res.jsonData.user.id.toString() === localUser._id.toString(),
        'Linked account has same user ID'
      );

      // Check DB: verify passwordHash was NOT erased or overwritten
      const refreshedUser = await User.findById(localUser._id);
      assert(refreshedUser.googleId === localGoogleSub, 'googleId was linked to existing user');
      assert(refreshedUser.passwordHash === localPasswordHash, 'Existing passwordHash was preserved intact');

      // Cleanup test documents
      await User.deleteMany({ email: { $in: [testGoogleEmail, localEmail] } });
      await Organisation.deleteMany({ name: 'Devon Innovators' });
      console.log('Test 7, 8, 9 passed successfully in MongoDB.\n');
    } else {
      console.log('  [Skip DB Steps 7-9: MongoDB offline in this test run]\n');
    }

    // Restore original prototype
    OAuth2Client.prototype.verifyIdToken = origVerify;

    // -----------------------------------------------------------------
    // TEST 10: Frontend Services & Component Verification
    // -----------------------------------------------------------------
    console.log('--- TEST 10: Frontend Service & Component Contracts ---');
    const apiFile = fs.readFileSync(path.join(__dirname, '../../../client/src/services/api.js'), 'utf8');
    assert(apiFile.includes('export const googleLoginApi'), 'api.js exports googleLoginApi');
    assert(apiFile.includes("fetch(`${API_BASE_URL}/auth/google`"), 'googleLoginApi targets /auth/google');

    const authContextFile = fs.readFileSync(path.join(__dirname, '../../../client/src/context/AuthContext.jsx'), 'utf8');
    assert(authContextFile.includes('loginWithGoogle'), 'AuthContext exposes loginWithGoogle');

    const googleBtnFile = fs.readFileSync(path.join(__dirname, '../../../client/src/components/GoogleAuthButton.jsx'), 'utf8');
    assert(googleBtnFile.includes('GoogleAuthButton'), 'GoogleAuthButton component exists');
    assert(googleBtnFile.includes('VITE_GOOGLE_CLIENT_ID'), 'GoogleAuthButton checks VITE_GOOGLE_CLIENT_ID');

    const loginFile = fs.readFileSync(path.join(__dirname, '../../../client/src/pages/Login.jsx'), 'utf8');
    assert(loginFile.includes('GoogleAuthButton'), 'Login page renders GoogleAuthButton');

    const registerFile = fs.readFileSync(path.join(__dirname, '../../../client/src/pages/Register.jsx'), 'utf8');
    assert(registerFile.includes('GoogleAuthButton'), 'Register page renders GoogleAuthButton');

    const landingFile = fs.readFileSync(path.join(__dirname, '../../../client/src/pages/Landing.jsx'), 'utf8');
    assert(landingFile.includes('Bring Your Team, Projects and Tasks'), 'Landing page contains exact hero heading');
    assert(landingFile.includes('Plan projects, coordinate teams, assign tasks'), 'Landing page contains exact hero description');
    assert(!landingFile.includes('99.9%'), 'Landing page removed fake 99.9% claim');
    assert(!landingFile.includes('Siddharth Kumar'), 'Landing page removed fake testimonial');

    console.log('Test 10 passed successfully.\n');

  } finally {
    // Restore original environment
    if (originalGoogleClientId) {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    } else {
      delete process.env.GOOGLE_CLIENT_ID;
    }
  }

  console.log('======================================================');
  console.log(`✅ All ${passedTests}/${totalTests} tests PASSED!`);
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed with error:', err);
  process.exit(1);
});
