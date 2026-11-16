/**
 * testPlanLimits.js
 * ─────────────────
 * Verifies strict plan feature quotas:
 * - Free tier allows maximum 5 members (Owner + 4 added members). Attempting to add 6th member throws 403.
 * - Free tier allows maximum 3 active projects. Attempting to create 4th project throws 403.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('\n=== Testing Free Plan Enforced Quotas (5 Members & 3 Projects) ===\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow';
  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  try {
    const timestamp = Date.now();
    // 1. Register a fresh organisation on Free plan (Member count starts at 1: the Owner)
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Quota Owner',
      email: `quota_owner_${timestamp}@test.io`,
      password: 'Password123!',
      organisationName: `Quota Test Org ${timestamp}`,
    });

    const token = regRes.data.token;
    const orgId = regRes.data.organisation.id;
    console.log(`[Setup] Registered owner on Free plan (Initial members: 1 / 5, projects: 0 / 3)`);

    // 2. Add 4 more members (total becomes 5 / 5)
    for (let i = 1; i <= 4; i++) {
      const addRes = await request(
        'POST',
        `/api/orgs/${orgId}/members`,
        {
          name: `Member ${i}`,
          email: `member_${i}_${timestamp}@test.io`,
          role: 'member',
        },
        { Authorization: `Bearer ${token}` }
      );
      if (addRes.status !== 201) {
        throw new Error(`Failed to add member ${i}: ${JSON.stringify(addRes.data)}`);
      }
      console.log(`Added Member ${i} successfully (Total members: ${i + 1} / 5)`);
    }

    // 3. Attempt to add 6th member (should fail with 403 Forbidden)
    console.log('\nAttempting to add 6th member (exceeding limit of 5)...');
    const badMemberRes = await request(
      'POST',
      `/api/orgs/${orgId}/members`,
      {
        name: 'Member 6 (Overflow)',
        email: `member_6_${timestamp}@test.io`,
        role: 'member',
      },
      { Authorization: `Bearer ${token}` }
    );

    console.log(`Response Status: ${badMemberRes.status}`);
    console.log(`Error Message: ${badMemberRes.data?.error?.message}`);

    if (badMemberRes.status !== 403 || badMemberRes.data?.error?.code !== 'PLAN_LIMIT_REACHED') {
      throw new Error(`Expected 403 PLAN_LIMIT_REACHED, got ${badMemberRes.status}`);
    }
    console.log('✅ Verified: 6th member successfully blocked by Free Plan 5-member limit!\n');

    // 4. Create 3 projects (max for Free plan)
    for (let p = 1; p <= 3; p++) {
      const projRes = await request(
        'POST',
        '/api/projects',
        {
          name: `Project ${p}`,
          description: `Description for project ${p}`,
          status: 'In Progress',
          orgId,
        },
        { Authorization: `Bearer ${token}` }
      );
      if (projRes.status !== 201) {
        throw new Error(`Failed to create project ${p}: ${JSON.stringify(projRes.data)}`);
      }
      console.log(`Created Project ${p} successfully (Total projects: ${p} / 3)`);
    }

    // 5. Attempt to create 4th project (should fail with 403 Forbidden)
    console.log('\nAttempting to create 4th project (exceeding limit of 3)...');
    const badProjRes = await request(
      'POST',
      '/api/projects',
      {
        name: 'Project 4 (Overflow)',
        description: 'Should be blocked',
        status: 'Planning',
        orgId,
      },
      { Authorization: `Bearer ${token}` }
    );

    console.log(`Response Status: ${badProjRes.status}`);
    console.log(`Error Message: ${badProjRes.data?.error?.message}`);

    if (badProjRes.status !== 403 || badProjRes.data?.error?.code !== 'PLAN_LIMIT_REACHED') {
      throw new Error(`Expected 403 PLAN_LIMIT_REACHED for projects, got ${badProjRes.status}`);
    }
    console.log('✅ Verified: 4th project successfully blocked by Free Plan 3-project limit!\n');

    console.log('🎉 ALL PLAN QUOTA ENFORCEMENT TESTS PASSED!');
  } finally {
    if (server) await new Promise((res) => server.close(res));
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
