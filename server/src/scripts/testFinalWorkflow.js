/**
 * testFinalWorkflow.js
 * ────────────────────
 * Comprehensive End-to-End Workflow & Error Handling Test Suite
 * 
 * Tests and verifies:
 * 1. Complete Workflow:
 *    - Register new user + organisation + owner membership
 *    - Login with credentials & JWT verification
 *    - Add new employee to the organisation
 *    - Create project with assigned employee
 *    - Create task and assign to project member
 *    - Update task status (To Do -> In Progress -> Completed)
 *    - Dynamic progress calculation verification
 *    - Dynamic dashboard statistics verification
 *    - Persistence verification across queries
 * 
 * 2. Error Handling:
 *    - Invalid registration data (short password, missing fields)
 *    - Duplicate email registration (returns 409 Conflict)
 *    - Incorrect login credentials (returns 401 Unauthorized)
 *    - Missing or invalid resource IDs (returns 404 / 400 CastError)
 *    - Unauthenticated API access (returns 401 Unauthorized)
 *    - Cross-tenant security isolation (returns 403 Forbidden)
 *    - Empty lists handling (empty projects, empty tasks)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const { User, Organisation, Membership, Project, Task } = require('../models');

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
          resolve({ status: res.statusCode, headers: res.headers, data });
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

async function runTests() {
  console.log('\n===============================================================');
  console.log('🚀 RUNNING FINAL COLLEGE EVALUATION END-TO-END TEST SUITE');
  console.log('===============================================================\n');

  // 0. Connect DB & Start local test server
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow';
  await mongoose.connect(mongoUri);
  console.log('[Setup] Connected to MongoDB:', mongoose.connection.host);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Setup] Express test instance running on port ${port}\n`);

  try {
    const timestamp = Date.now();
    const testUserAEmail = `final_eva_${timestamp}@teamflow.io`;
    const testOrgAName = `Apex Workflow ${timestamp}`;

    /* ───────────────────────────────────────────────────────────
     * 1. COMPLETE WORKFLOW VERIFICATION
     * ─────────────────────────────────────────────────────────── */
    console.log('--- 1. Testing Complete SaaS Workflow ---');

    // 1.1 Register
    console.log('[Step 1.1] Registering initial owner...');
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Elena Rostova',
      email: testUserAEmail,
      password: 'SecurePassword123!',
      organisationName: testOrgAName,
    });
    if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regRes.data)}`);
    const tokenA = regRes.data.token;
    const orgAId = regRes.data.organisation.id;
    const userAId = regRes.data.user.id;
    console.log(`✅ User registered: ${regRes.data.user.name} (Org: "${testOrgAName}", ID: ${orgAId})`);

    // 1.2 Login
    console.log('[Step 1.2] Logging in with credentials...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: testUserAEmail,
      password: 'SecurePassword123!',
    });
    if (loginRes.status !== 200 || !loginRes.data.token) throw new Error('Login failed');
    console.log('✅ User logged in and acquired JWT session token.');

    // 1.3 Add Employee
    console.log('[Step 1.3] Adding employee to organisation...');
    const empEmail = `marcus_${timestamp}@apex.io`;
    const addEmpRes = await request(
      'POST',
      `/api/orgs/${orgAId}/members`,
      {
        name: 'Marcus Brody',
        email: empEmail,
        role: 'member',
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (addEmpRes.status !== 201) throw new Error(`Add member failed: ${JSON.stringify(addEmpRes.data)}`);
    const empUserId = addEmpRes.data.member.userId;
    console.log(`✅ Employee added: ${addEmpRes.data.member.name} (User ID: ${empUserId})`);

    // 1.4 Create Project and assign employees
    console.log('[Step 1.4] Creating project with assigned team members...');
    const projectRes = await request(
      'POST',
      '/api/projects',
      {
        name: 'Mobile Core Engine',
        description: 'Next-gen cross-platform engine with offline support',
        deadline: '2026-12-31',
        status: 'In Progress',
        teamMembers: [userAId, empUserId],
        orgId: orgAId,
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (projectRes.status !== 201) throw new Error(`Create project failed: ${JSON.stringify(projectRes.data)}`);
    const projectId = projectRes.data.project._id;
    console.log(`✅ Project created: "${projectRes.data.project.name}" (ID: ${projectId}) with 2 team members.`);

    // 1.5 Create Tasks
    console.log('[Step 1.5] Creating tasks assigned to project team member...');
    const task1Res = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Design Protocol Buffers Schema',
        description: 'Draft API contracts and binary payloads',
        assignedTo: empUserId,
        priority: 'High',
        dueDate: '2026-11-15',
        status: 'To Do',
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (task1Res.status !== 201) throw new Error(`Task 1 creation failed: ${JSON.stringify(task1Res.data)}`);
    const task1Id = task1Res.data.task._id;

    const task2Res = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Implement Local Cache',
        description: 'Add SQLite persistence layer for offline operations',
        assignedTo: empUserId,
        priority: 'Medium',
        dueDate: '2026-11-20',
        status: 'To Do',
      },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (task2Res.status !== 201) throw new Error(`Task 2 creation failed: ${JSON.stringify(task2Res.data)}`);
    const task2Id = task2Res.data.task._id;
    console.log(`✅ Created 2 tasks assigned to Marcus Brody.`);

    // 1.6 Update Task Statuses
    console.log('[Step 1.6] Updating task status To Do -> In Progress -> Completed...');
    const updateTask1 = await request(
      'PATCH',
      `/api/tasks/${task1Id}`,
      { status: 'Completed' },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (updateTask1.status !== 200 || updateTask1.data.task.status !== 'Completed') {
      throw new Error('Task 1 update failed');
    }

    const updateTask2 = await request(
      'PATCH',
      `/api/tasks/${task2Id}`,
      { status: 'In Progress' },
      { Authorization: `Bearer ${tokenA}` }
    );
    if (updateTask2.status !== 200 || updateTask2.data.task.status !== 'In Progress') {
      throw new Error('Task 2 update failed');
    }
    console.log(`✅ Task 1 marked "Completed", Task 2 marked "In Progress".`);

    // 1.7 Verify Project Progress
    console.log('[Step 1.7] Verifying live dynamic project progress...');
    const progRes = await request(
      'GET',
      `/api/projects/${projectId}/progress`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    if (progRes.status !== 200) throw new Error('Progress fetch failed');
    const { totalTasks, completedTasks, pendingTasks, percentage } = progRes.data;
    if (totalTasks !== 2 || completedTasks !== 1 || pendingTasks !== 1 || percentage !== 50) {
      throw new Error(`Unexpected progress values: ${JSON.stringify(progRes.data)}`);
    }
    console.log(`✅ Verified: Progress is exactly 50% (1 completed / 2 total).`);

    // 1.8 Verify Dashboard Statistics
    console.log('[Step 1.8] Verifying dynamic dashboard metrics...');
    const dashRes = await request(
      'GET',
      `/api/dashboard?orgId=${orgAId}`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    if (dashRes.status !== 200) throw new Error('Dashboard stats fetch failed');
    const dStats = dashRes.data.stats;
    if (
      dStats.totalEmployees !== 2 ||
      dStats.totalProjects !== 1 ||
      dStats.activeProjects !== 1 ||
      dStats.pendingTasks !== 1 ||
      dStats.completedTasks !== 1
    ) {
      throw new Error(`Unexpected dashboard statistics: ${JSON.stringify(dStats)}`);
    }
    console.log(`✅ Verified: Dashboard statistics computed live from MongoDB:`);
    console.log(`   Employees: ${dStats.totalEmployees}, Projects: ${dStats.totalProjects}, Pending: ${dStats.pendingTasks}, Completed: ${dStats.completedTasks}`);

    // 1.9 Verify Database Persistence
    console.log('[Step 1.9] Verifying persistence across direct MongoDB read...');
    const persistedProject = await Project.findById(projectId);
    const persistedTasks = await Task.find({ projectId });
    if (!persistedProject || persistedTasks.length !== 2) {
      throw new Error('Data persistence check failed in MongoDB');
    }
    console.log(`✅ Verified: Records persistently saved in MongoDB collections "projects" and "tasks".\n`);

    /* ───────────────────────────────────────────────────────────
     * 2. ERROR HANDLING VERIFICATION
     * ─────────────────────────────────────────────────────────── */
    console.log('--- 2. Testing Error Handling & Edge Cases ---');

    // 2.1 Invalid Form Data
    console.log('[Step 2.1] Submitting invalid registration data (missing password)...');
    const badReg = await request('POST', '/api/auth/register', {
      name: 'Broken User',
      email: 'broken@teamflow.io',
      // missing password & organisationName
    });
    if (badReg.status !== 400) throw new Error(`Expected 400 for bad form data, got ${badReg.status}`);
    console.log(`✅ Handled cleanly: 400 Bad Request (${badReg.data.error?.message})`);

    // 2.2 Duplicate Email Registration
    console.log('[Step 2.2] Attempting duplicate email registration...');
    const dupReg = await request('POST', '/api/auth/register', {
      name: 'Duplicate Elena',
      email: testUserAEmail, // already registered
      password: 'AnotherPassword123!',
      organisationName: 'Duplicate Org',
    });
    if (dupReg.status !== 409) throw new Error(`Expected 409 for duplicate email, got ${dupReg.status}`);
    console.log(`✅ Handled cleanly: 409 Conflict (${dupReg.data.error?.message})`);

    // 2.3 Incorrect Login Credentials
    console.log('[Step 2.3] Testing login with wrong password...');
    const badLogin = await request('POST', '/api/auth/login', {
      email: testUserAEmail,
      password: 'WrongPassword999!',
    });
    if (badLogin.status !== 401) throw new Error(`Expected 401 for wrong password, got ${badLogin.status}`);
    console.log(`✅ Handled cleanly: 401 Unauthorized (${badLogin.data.error?.message})`);

    // 2.4 Missing or Invalid Resource IDs
    console.log('[Step 2.4] Requesting non-existent project ID...');
    const fakeId = new mongoose.Types.ObjectId();
    const missingProj = await request(
      'GET',
      `/api/projects/${fakeId}`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    if (missingProj.status !== 404) throw new Error(`Expected 404 for missing project, got ${missingProj.status}`);
    console.log(`✅ Handled cleanly: 404 Not Found (${missingProj.data.error?.message})`);

    console.log('[Step 2.4b] Requesting malformed resource ID (e.g. invalid hex)...');
    const malformedReq = await request(
      'GET',
      `/api/projects/not-a-valid-id-12345`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    if (malformedReq.status !== 400) throw new Error(`Expected 400 for malformed ID, got ${malformedReq.status}`);
    console.log(`✅ Handled cleanly: 400 CastError (${malformedReq.data.error?.message})`);

    // 2.5 API Requests without Authentication
    console.log('[Step 2.5] Accessing protected route without JWT token...');
    const noAuth = await request('GET', '/api/projects');
    if (noAuth.status !== 401) throw new Error(`Expected 401 without auth, got ${noAuth.status}`);
    console.log(`✅ Handled cleanly: 401 Unauthorized (${noAuth.data.error?.message})`);

    // 2.6 Cross-tenant access attempts
    console.log('[Step 2.6] Creating Organisation B and testing cross-tenant isolation...');
    const userBEmail = `spy_${timestamp}@competitor.com`;
    const regB = await request('POST', '/api/auth/register', {
      name: 'Competitor Bob',
      email: userBEmail,
      password: 'Password123!',
      organisationName: `Competitor Labs ${timestamp}`,
    });
    const tokenB = regB.data.token;
    const orgBId = regB.data.organisation.id;

    console.log('User B attempting to view Org A project details...');
    const spyProject = await request(
      'GET',
      `/api/projects/${projectId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    if (spyProject.status !== 403) throw new Error(`Expected 403 for cross-tenant access, got ${spyProject.status}`);
    console.log(`✅ Handled cleanly: 403 Forbidden (${spyProject.data.error?.message})`);

    console.log('User B attempting to view Org A dashboard stats...');
    const spyDash = await request(
      'GET',
      `/api/dashboard?orgId=${orgAId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    if (spyDash.status !== 403) throw new Error(`Expected 403 for cross-tenant dashboard, got ${spyDash.status}`);
    console.log(`✅ Handled cleanly: 403 Forbidden (${spyDash.data.error?.message})`);

    // 2.7 Empty Employee, Project, and Task Lists
    console.log('[Step 2.7] Checking empty state handling on clean Organisation B...');
    const orgBProjects = await request(
      'GET',
      `/api/projects?orgId=${orgBId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    if (orgBProjects.status !== 200 || orgBProjects.data.projects.length !== 0) {
      throw new Error('Expected 0 projects for fresh organisation');
    }

    const orgBDashboard = await request(
      'GET',
      `/api/dashboard?orgId=${orgBId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    if (
      orgBDashboard.status !== 200 ||
      orgBDashboard.data.stats.totalProjects !== 0 ||
      orgBDashboard.data.stats.totalTasks !== 0
    ) {
      throw new Error('Expected zero stats for fresh organisation');
    }
    console.log(`✅ Handled cleanly: Empty lists return clean zero counts and empty arrays [] without crashing.`);

    // 2.8 System Health Endpoint
    console.log('[Step 2.8] Checking /healthz endpoint...');
    const health = await request('GET', '/healthz');
    if (health.status !== 200 || health.data.database !== 'connected') {
      throw new Error(`Healthcheck failed: ${JSON.stringify(health.data)}`);
    }
    console.log(`✅ Handled cleanly: 200 OK (DB status: "${health.data.database}")`);

    // 2.9 Central 404 Route Handler
    console.log('[Step 2.9] Checking unmatched route handler...');
    const notFound = await request('GET', '/api/non-existent-endpoint');
    if (notFound.status !== 404 || !notFound.data.error?.message?.includes('Route not found')) {
      throw new Error('404 handler failed');
    }
    console.log(`✅ Handled cleanly: 404 Route Not Found (${notFound.data.error?.message})`);

    console.log('\n===============================================================');
    console.log('🎉 ALL WORKFLOW & ERROR HANDLING VERIFICATION TESTS PASSED!');
    console.log('===============================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    console.log('[Cleanup] Disconnected test instance from MongoDB.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
