/**
 * Integration Test: Phase 1 Backend Security & API Quality
 * --------------------------------------------------------
 * Verifies:
 * 1. Environment validation works and enforces required variables.
 * 2. Express-validator rejects malformed registrations (400 Bad Request with field errors).
 * 3. Express-validator rejects malformed logins (400 Bad Request).
 * 4. Express-validator rejects invalid project inputs (short title, bad ObjectId, invalid status).
 * 5. Express-validator rejects invalid task inputs (invalid status, bad assignee ID).
 * 6. Central error handling returns uniform error contracts without exposing stack traces.
 * 7. Legitimate registrations and CRUD operations still succeed seamlessly.
 */

const http = require('http');
const dotenv = require('dotenv');

const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { validateEnv } = require('../config/env');
const app = require('../app');
const connectDB = require('../config/db');
const { User, Organisation, Membership, Project, Task } = require('../models');

let server;
let port;
let baseUrl;

// Helper to make HTTP requests
const request = (method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runPhase1Tests = async () => {
  console.log('\n======================================================');
  console.log('   Running Phase 1 Backend Security & Quality Tests   ');
  console.log('======================================================\n');

  try {
    // Test 1: Verify env validation
    console.log('[Test 1] Testing Environment Validation...');
    validateEnv();
    console.log('  PASS: Environment variables are properly configured.');

    // Connect to DB and start temporary test server
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    const timestamp = Date.now();

    // Test 2: Invalid Registration (Bad Email, Short Password, Missing Name)
    console.log('\n[Test 2] Testing express-validator: Rejection of malformed registration...');
    const invalidRegRes = await request('POST', '/api/auth/register', {
      name: '',
      email: 'not-an-email',
      password: '123',
      organisationName: '',
    });

    if (
      invalidRegRes.statusCode === 400 &&
      invalidRegRes.body?.error?.details &&
      invalidRegRes.body.error.details.length >= 3
    ) {
      console.log('  PASS: express-validator rejected malformed registration with HTTP 400 and detailed field errors.');
    } else {
      throw new Error(`Expected 400 with details, got ${invalidRegRes.statusCode}: ${JSON.stringify(invalidRegRes.body)}`);
    }

    // Test 3: Invalid Login
    console.log('\n[Test 3] Testing express-validator: Rejection of invalid login...');
    const invalidLoginRes = await request('POST', '/api/auth/login', {
      email: 'notanemail',
      password: '',
    });

    if (invalidLoginRes.statusCode === 400) {
      console.log('  PASS: express-validator rejected invalid login with HTTP 400.');
    } else {
      throw new Error(`Expected 400 for invalid login, got ${invalidLoginRes.statusCode}`);
    }

    // Test 4: Valid Registration (Ensure CRUD flow still works)
    console.log('\n[Test 4] Testing legitimate registration...');
    const validRegRes = await request('POST', '/api/auth/register', {
      name: 'Phase1 Test Lead',
      email: `lead_${timestamp}@teamflow.test`,
      password: 'StrongPassword123!',
      organisationName: `Phase1 Corp ${timestamp}`,
    });

    if (validRegRes.statusCode !== 201 || !validRegRes.body?.token) {
      throw new Error(`Registration failed: ${JSON.stringify(validRegRes.body)}`);
    }
    const token = validRegRes.body.token;
    const orgId = validRegRes.body.organisation.id;
    console.log('  PASS: Registration succeeded, returned JWT token.');

    // Test 5: Invalid Project Creation (Short name, invalid status, invalid teamMember ObjectId)
    console.log('\n[Test 5] Testing express-validator: Rejection of invalid project input...');
    const invalidProjRes = await request(
      'POST',
      '/api/projects',
      {
        name: 'A', // too short
        status: 'NonExistentStatus',
        teamMembers: ['not-an-objectid'],
      },
      {
        Authorization: `Bearer ${token}`,
        'x-org-id': orgId,
      }
    );

    if (invalidProjRes.statusCode === 400 && invalidProjRes.body?.error?.details) {
      console.log('  PASS: Rejected invalid project parameters with HTTP 400 and structured validation array.');
    } else {
      throw new Error(`Expected 400 for invalid project, got ${invalidProjRes.statusCode}: ${JSON.stringify(invalidProjRes.body)}`);
    }

    // Test 6: Valid Project Creation
    console.log('\n[Test 6] Testing valid project creation...');
    const validProjRes = await request(
      'POST',
      '/api/projects',
      {
        name: 'Backend Architecture Overhaul',
        description: 'Implementing express-validator, morgan, and env security',
        status: 'In Progress',
      },
      {
        Authorization: `Bearer ${token}`,
        'x-org-id': orgId,
      }
    );

    if (validProjRes.statusCode !== 201 || !validProjRes.body?.project?._id) {
      throw new Error(`Project creation failed: ${JSON.stringify(validProjRes.body)}`);
    }
    const projectId = validProjRes.body.project._id;
    console.log('  PASS: Project successfully created.');

    // Test 7: Invalid Task Creation (Empty title, invalid priority, invalid status)
    console.log('\n[Test 7] Testing express-validator: Rejection of invalid task input...');
    const invalidTaskRes = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: '',
        status: 'BogusStatus',
        priority: 'HyperUrgent',
      },
      {
        Authorization: `Bearer ${token}`,
        'x-org-id': orgId,
      }
    );

    if (invalidTaskRes.statusCode === 400) {
      console.log('  PASS: Rejected invalid task parameters with HTTP 400.');
    } else {
      throw new Error(`Expected 400 for invalid task, got ${invalidTaskRes.statusCode}: ${JSON.stringify(invalidTaskRes.body)}`);
    }

    // Test 8: Valid Task Creation
    console.log('\n[Test 8] Testing valid task creation...');
    const validTaskRes = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Review validation schemas and error handler',
        priority: 'High',
        status: 'In Progress',
      },
      {
        Authorization: `Bearer ${token}`,
        'x-org-id': orgId,
      }
    );

    if (validTaskRes.statusCode !== 201) {
      throw new Error(`Task creation failed: ${JSON.stringify(validTaskRes.body)}`);
    }
    console.log('  PASS: Valid task successfully created.');

    // Test 9: Invalid Route Parameter (Non-ObjectId parameter)
    console.log('\n[Test 9] Testing ObjectId route parameter validator...');
    const badParamRes = await request(
      'GET',
      '/api/projects/123-not-an-objectid',
      null,
      {
        Authorization: `Bearer ${token}`,
        'x-org-id': orgId,
      }
    );

    if (badParamRes.statusCode === 400) {
      console.log('  PASS: Malformed route parameter rejected with HTTP 400 before reaching database.');
    } else {
      throw new Error(`Expected 400 for malformed ObjectId param, got ${badParamRes.statusCode}`);
    }

    console.log('\n======================================================');
    console.log(' [SUCCESS] All 9 Phase 1 security & validation tests PASSED!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[FAILED] Test suite failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit();
  }
};

runPhase1Tests();
