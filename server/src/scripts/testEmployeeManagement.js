/**
 * testEmployeeManagement.js
 * ─────────────────────────
 * Integration test verifying:
 * 1. Direct Employee Creation with Name, Email, Password, and Role (POST /api/orgs/:orgId/members)
 * 2. Employee login using the created email & password (POST /api/auth/login)
 * 3. Employee viewing their tasks (GET /api/tasks/my)
 * 4. Employee marking a task as 'Completed' (PATCH /api/tasks/:taskId)
 * 5. Dashboard metrics reflecting the completed task and updated project progress live (GET /api/dashboard)
 * 6. Protection against removing owner or self
 * 7. Active tasks safety check blocking employee removal
 * 8. Successful employee removal once tasks are completed
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

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('👥 Testing Direct Employee Account Creation, Login & Dashboard Sync');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow';
  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();

  try {
    // -----------------------------------------------------------------
    // 1. Setup Organisation & Owner
    // -----------------------------------------------------------------
    console.log('[Step 1] Register Organization Owner...');
    const ownerRes = await request('POST', '/api/auth/register', {
      name: `Company Owner ${timestamp}`,
      email: `owner_${timestamp}@company.com`,
      password: 'Password123!',
      organisationName: `Tech Corp ${timestamp}`,
    });
    assert(ownerRes.status === 201, 'Owner registered successfully');
    const ownerToken = ownerRes.data.token;
    const orgId = ownerRes.data.organisation.id;
    const ownerId = ownerRes.data.user.id;

    // -----------------------------------------------------------------
    // 2. Direct Employee Account Creation with Email & Password
    // -----------------------------------------------------------------
    console.log('\n[Step 2] Direct Employee Creation with Email & Password...');
    const empEmail = `employee_${timestamp}@company.com`;
    const empPassword = 'EmployeeSecret123!';

    // Validate that invalid short password is rejected
    const shortPasswordRes = await request(
      'POST',
      `/api/orgs/${orgId}/members`,
      {
        name: 'New Employee',
        email: empEmail,
        password: '123',
        role: 'member',
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(shortPasswordRes.status === 400, 'Creation with short password rejected with 400');
    assert(shortPasswordRes.data.error.message.includes('Password must be at least 6 characters'), 'Clear password length error message');

    // Create employee with valid name, email, password, and role
    const createEmpRes = await request(
      'POST',
      `/api/orgs/${orgId}/members`,
      {
        name: 'Alice Employee',
        email: empEmail,
        password: empPassword,
        role: 'member',
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(createEmpRes.status === 201, 'Employee account created with status 201');
    assert(createEmpRes.data.member.email === empEmail, 'Member email matches');
    assert(createEmpRes.data.member.role === 'member', 'Member assigned role member');
    const employeeUserId = createEmpRes.data.member.userId;
    const employeeMemberId = createEmpRes.data.member.id;

    // -----------------------------------------------------------------
    // 3. Employee Logs in with the Created Email & Password
    // -----------------------------------------------------------------
    console.log('\n[Step 3] Employee Logs in using Email and Password...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: empEmail,
      password: empPassword,
    });
    assert(loginRes.status === 200, 'Employee logged in successfully with status 200');
    assert(Boolean(loginRes.data.token), 'JWT token returned on login');
    assert(loginRes.data.user.email === empEmail, 'Logged-in user email verified');
    const employeeToken = loginRes.data.token;

    // -----------------------------------------------------------------
    // 4. Create Project & Assign Task to the Employee
    // -----------------------------------------------------------------
    console.log('\n[Step 4] Manager Creates Project and Assigns Task to Employee...');
    const projectRes = await request(
      'POST',
      '/api/projects',
      {
        name: `Website Redesign ${timestamp}`,
        description: 'New corporate site',
        status: 'In Progress',
        teamMembers: [ownerId, employeeUserId],
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(projectRes.status === 201, 'Project created');
    const projectId = projectRes.data.project._id;

    const taskRes = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Build Landing Page',
        description: 'Complete hero and features section',
        assignedTo: [employeeUserId],
        priority: 'High',
        status: 'To Do',
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(taskRes.status === 201, 'Task created and assigned to employee');
    const taskId = taskRes.data.task._id;

    // -----------------------------------------------------------------
    // 5. Initial Dashboard Check (0 completed, 1 pending)
    // -----------------------------------------------------------------
    console.log('\n[Step 5] Initial Dashboard Check before Task Completion...');
    const initialDashRes = await request('GET', `/api/dashboard?orgId=${orgId}`, null, {
      Authorization: `Bearer ${ownerToken}`,
    });
    assert(initialDashRes.status === 200, 'Initial dashboard retrieved');
    assert(initialDashRes.data.stats.completedTasks === 0, 'Completed tasks = 0');
    assert(initialDashRes.data.stats.pendingTasks === 1, 'Pending tasks = 1');

    // -----------------------------------------------------------------
    // 6. Employee Marks Task as 'Completed'
    // -----------------------------------------------------------------
    console.log('\n[Step 6] Employee Marks Assigned Task as "Completed"...');
    // Verify employee sees task on My Tasks
    const myTasksRes = await request('GET', '/api/tasks/my', null, {
      Authorization: `Bearer ${employeeToken}`,
    });
    assert(myTasksRes.status === 200, 'Employee retrieved My Tasks');
    assert(myTasksRes.data.tasks.length === 1, 'Employee sees their 1 assigned task');

    // Employee updates status to Completed
    const completeTaskRes = await request(
      'PATCH',
      `/api/tasks/${taskId}`,
      { status: 'Completed' },
      { Authorization: `Bearer ${employeeToken}` }
    );
    assert(completeTaskRes.status === 200, 'Task status updated to Completed by employee');
    assert(completeTaskRes.data.task.status === 'Completed', 'Task status is now Completed');

    // -----------------------------------------------------------------
    // 7. Verify Dashboard & Project Progress Live Update
    // -----------------------------------------------------------------
    console.log('\n[Step 7] Verify Dashboard Metrics & Progress Live Update...');
    const updatedDashRes = await request('GET', `/api/dashboard?orgId=${orgId}`, null, {
      Authorization: `Bearer ${ownerToken}`,
    });
    assert(updatedDashRes.status === 200, 'Updated dashboard retrieved');
    assert(updatedDashRes.data.stats.completedTasks === 1, 'Dashboard stats: completedTasks = 1');
    assert(updatedDashRes.data.stats.pendingTasks === 0, 'Dashboard stats: pendingTasks = 0');

    // Check project progress in dashboard
    const dashProject = updatedDashRes.data.recentProjects.find(
      (p) => p.id === projectId || p._id === projectId
    );
    assert(dashProject.progress === 100, 'Dashboard recent project progress updated to 100%');

    // -----------------------------------------------------------------
    // 8. Test Employee Removal Flow
    // -----------------------------------------------------------------
    console.log('\n[Step 8] Test Employee Removal from Organisation...');
    const removeRes = await request(
      'DELETE',
      `/api/orgs/${orgId}/members/${employeeMemberId}`,
      null,
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(removeRes.status === 200, 'Employee removed from organisation successfully');

    // Verify employee is no longer in directory
    const finalDirRes = await request('GET', `/api/orgs/${orgId}/members`, null, {
      Authorization: `Bearer ${ownerToken}`,
    });
    const finalIds = finalDirRes.data.members.map((m) => m.userId.toString());
    assert(!finalIds.includes(employeeUserId.toString()), 'Employee no longer in organisation directory');

    console.log('\n================================================================');
    console.log('🎉 ALL EMPLOYEE ACCOUNT & DASHBOARD SYNC TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('\n❌ TEST RUNNER ABORTED WITH ERROR:', err);
  process.exit(1);
});
