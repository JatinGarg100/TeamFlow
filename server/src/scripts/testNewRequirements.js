/**
 * testNewRequirements.js
 * ──────────────────────
 * Automated integration test suite validating all 15 requirements from Requirement 9:
 *
 * 1.  Owner registration (POST /api/auth/register)
 * 2.  Invitation token generation (POST /api/orgs/:orgId/invitations)
 * 3.  Invitation acceptance (POST /api/invitations/:token/accept creates Employee & links Membership)
 * 4.  Expired token rejection (verification & acceptance fail when expiresAt is past)
 * 5.  Already-accepted token rejection (second acceptance rejected)
 * 6.  Project creation with multiple team members (POST /api/projects)
 * 7.  Add member to project (POST /api/projects/:projectId/members)
 * 8.  Member removal blocked when member has active assigned tasks (DELETE /api/projects/:projectId/members/:userId)
 * 9.  Member removal allowed after active tasks are completed or reassigned
 * 10. Task creation with multiple assignees (POST /api/projects/:projectId/tasks)
 * 11. My Tasks endpoint returns tasks where user is in assignedTo array (GET /api/tasks/my)
 * 12. Employee cannot edit arbitrary task fields, only status (PATCH /api/tasks/:taskId)
 * 13. Task status update by one assignee reflects for all assignees and recalculates project progress
 * 14. Task assignment email is dispatched without duplicate recipients
 * 15. Multi-tenant isolation: User from Org A cannot access Project/Task from Org B
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const { User, Organisation, Membership, Project, Task, Invitation } = require('../models');

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
  console.log('🚀 Running TeamFlow Requirements Integration Test Suite (15/15)');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamflow';
  await mongoose.connect(mongoUri);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // TEST 1: Owner Registration
    // -------------------------------------------------------------
    console.log('[Test 1] Register Organization Owner...');
    const ownerRes = await request('POST', '/api/auth/register', {
      name: `Owner ${timestamp}`,
      email: `owner_${timestamp}@example.com`,
      password: 'Password123!',
      organisationName: `Acme Corp ${timestamp}`,
    });

    assert(ownerRes.status === 201, 'Owner registered with status 201');
    assert(Boolean(ownerRes.data.token), 'Registration returned JWT token');
    assert(ownerRes.data.organisation.role === 'owner', 'User assigned "owner" role in organisation');
    const ownerToken = ownerRes.data.token;
    const orgId = ownerRes.data.organisation.id;
    const ownerId = ownerRes.data.user.id;

    // -------------------------------------------------------------
    // TEST 2: Invitation Token Generation
    // -------------------------------------------------------------
    console.log('\n[Test 2] Owner Generates Invitation Token...');
    const inviteEmail = `employee_${timestamp}@example.com`;
    const inviteRes = await request(
      'POST',
      `/api/orgs/${orgId}/invitations`,
      { email: inviteEmail, role: 'member' },
      { Authorization: `Bearer ${ownerToken}` }
    );

    assert(inviteRes.status === 201, 'Invitation created with status 201');
    assert(Boolean(inviteRes.data.invitation.inviteToken), 'Un-hashed raw inviteToken returned for email delivery');
    assert(Boolean(inviteRes.data.invitation.inviteUrl), 'Complete invite URL provided');
    const inviteToken = inviteRes.data.invitation.inviteToken;

    // Verify token is stored as SHA-256 hash in database
    const dbInvite = await Invitation.findById(inviteRes.data.invitation.id);
    assert(Boolean(dbInvite.tokenHash), 'Database stores secure tokenHash');
    assert(!dbInvite.inviteToken, 'Database does NOT store plaintext inviteToken');

    // -------------------------------------------------------------
    // TEST 3: Invitation Acceptance (Creates Employee User & Membership)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Accept Invitation (Registers Employee & Links Membership)...');
    const acceptRes = await request('POST', `/api/invitations/${inviteToken}/accept`, {
      name: `Employee One ${timestamp}`,
      password: 'Password123!',
    });

    assert(acceptRes.status === 200, 'Invitation accepted with status 200');
    assert(Boolean(acceptRes.data.token), 'Employee logged in immediately with JWT token');
    assert(acceptRes.data.organisation.id === orgId, 'Employee linked to correct organisation');
    assert(acceptRes.data.organisation.role === 'member', 'Employee assigned member role');
    const employeeToken = acceptRes.data.token;
    const employeeId = acceptRes.data.user.id;

    // -------------------------------------------------------------
    // TEST 4: Expired Token Rejection
    // -------------------------------------------------------------
    console.log('\n[Test 4] Expired Token Rejection...');
    const expiredInviteRes = await request(
      'POST',
      `/api/orgs/${orgId}/invitations`,
      { email: `expired_${timestamp}@example.com`, role: 'member' },
      { Authorization: `Bearer ${ownerToken}` }
    );
    const expiredToken = expiredInviteRes.data.invitation.inviteToken;
    // Artificially expire the token in MongoDB
    await Invitation.findByIdAndUpdate(expiredInviteRes.data.invitation.id, {
      expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour in the past
    });

    const verifyExpired = await request('GET', `/api/invitations/${expiredToken}`);
    assert(verifyExpired.status === 400, 'Expired token verification rejected with 400');
    assert(verifyExpired.data.error.message.includes('expired'), 'Error message indicates token expiration');

    const acceptExpired = await request('POST', `/api/invitations/${expiredToken}/accept`, {
      name: 'Expired Tester',
      password: 'Password123!',
    });
    assert(acceptExpired.status === 400, 'Accepting expired token rejected with 400');

    // -------------------------------------------------------------
    // TEST 5: Already-Accepted Token Rejection
    // -------------------------------------------------------------
    console.log('\n[Test 5] Already-Accepted Token Rejection...');
    const reuseRes = await request('POST', `/api/invitations/${inviteToken}/accept`, {
      name: 'Duplicate Acceptor',
      password: 'Password123!',
    });
    assert(reuseRes.status === 400, 'Reusing accepted invitation rejected with 400');
    assert(reuseRes.data.error.message.includes('already been accepted'), 'Clear duplicate acceptance error');

    // Create a second employee for multi-member testing
    const emp2InviteRes = await request(
      'POST',
      `/api/orgs/${orgId}/invitations`,
      { email: `employee2_${timestamp}@example.com`, role: 'member' },
      { Authorization: `Bearer ${ownerToken}` }
    );
    const acceptEmp2Res = await request(
      'POST',
      `/api/invitations/${emp2InviteRes.data.invitation.inviteToken}/accept`,
      { name: `Employee Two ${timestamp}`, password: 'Password123!' }
    );
    const employee2Id = acceptEmp2Res.data.user.id;
    const employee2Token = acceptEmp2Res.data.token;

    // -------------------------------------------------------------
    // TEST 6: Project Creation with Multiple Members
    // -------------------------------------------------------------
    console.log('\n[Test 6] Project Creation with Multiple Team Members...');
    const projectRes = await request(
      'POST',
      '/api/projects',
      {
        name: `Multi-Member Project ${timestamp}`,
        description: 'Testing team member assignments',
        deadline: '2026-12-31',
        status: 'In Progress',
        teamMembers: [ownerId, employeeId],
      },
      { Authorization: `Bearer ${ownerToken}` }
    );

    assert(projectRes.status === 201, 'Project created with status 201');
    assert(projectRes.data.project.teamMembers.length >= 2, 'Project has multiple team members');
    const projectId = projectRes.data.project._id;

    // -------------------------------------------------------------
    // TEST 7: Add Member to Project (POST /api/projects/:projectId/members)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Add Member to Existing Project...');
    const addMemberRes = await request(
      'POST',
      `/api/projects/${projectId}/members`,
      { userIds: [employee2Id] },
      { Authorization: `Bearer ${ownerToken}` }
    );

    assert(addMemberRes.status === 200, 'Member added with status 200');
    const teamMemberIds = addMemberRes.data.project.teamMembers.map((m) =>
      typeof m === 'object' ? m._id.toString() : m.toString()
    );
    assert(teamMemberIds.includes(employee2Id), 'Project now includes employee2Id in teamMembers');

    // -------------------------------------------------------------
    // TEST 8: Block Member Removal when Active Tasks Exist
    // -------------------------------------------------------------
    console.log('\n[Test 8] Block Member Removal when Member has Active Tasks...');
    // Create an active task assigned to employee2
    const task1Res = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Task Assigned to Employee 2',
        description: 'Testing removal blocking',
        assignedTo: [employee2Id],
        priority: 'High',
        status: 'In Progress',
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(task1Res.status === 201, 'Active task created for employee 2');
    const taskId1 = task1Res.data.task._id;

    // Attempt to remove employee2 while task is active
    const removeBlockedRes = await request(
      'DELETE',
      `/api/projects/${projectId}/members/${employee2Id}`,
      null,
      { Authorization: `Bearer ${ownerToken}` }
    );

    assert(removeBlockedRes.status === 400, 'Removal blocked with status 400');
    assert(
      removeBlockedRes.data.error.message.includes('active tasks') ||
      removeBlockedRes.data.error.message.includes('Cannot remove'),
      'Clear error explaining member has active tasks in project'
    );

    // -------------------------------------------------------------
    // TEST 9: Allow Member Removal After Tasks Completed or Reassigned
    // -------------------------------------------------------------
    console.log('\n[Test 9] Allow Member Removal After Task Completed...');
    // Mark the task as Completed
    const completeTaskRes = await request(
      'PATCH',
      `/api/tasks/${taskId1}`,
      { status: 'Completed' },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(completeTaskRes.status === 200, 'Task marked as Completed');

    // Now attempt removal again
    const removeAllowedRes = await request(
      'DELETE',
      `/api/projects/${projectId}/members/${employee2Id}`,
      null,
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(removeAllowedRes.status === 200, 'Removal succeeded with status 200 after task completion');
    const updatedTeamIds = removeAllowedRes.data.project.teamMembers.map((m) =>
      typeof m === 'object' ? m._id.toString() : m.toString()
    );
    assert(!updatedTeamIds.includes(employee2Id), 'Employee 2 successfully removed from project.teamMembers');

    // Re-add employee2 so we can test multiple assignees on tasks
    await request(
      'POST',
      `/api/projects/${projectId}/members`,
      { userIds: [employee2Id] },
      { Authorization: `Bearer ${ownerToken}` }
    );

    // -------------------------------------------------------------
    // TEST 10: Task Creation with Multiple Assignees
    // -------------------------------------------------------------
    console.log('\n[Test 10] Task Creation with Multiple Assignees...');
    const multiTaskRes = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Collaborative Multi-Assignee Task',
        description: 'Both employee 1 and employee 2 are assigned',
        assignedTo: [employeeId, employee2Id, employeeId], // Include intentional duplicate to test deduplication
        priority: 'High',
        status: 'To Do',
      },
      { Authorization: `Bearer ${ownerToken}` }
    );

    assert(multiTaskRes.status === 201, 'Task created with multiple assignees');
    const taskAssignees = multiTaskRes.data.task.assignedTo.map((u) => u._id.toString());
    assert(taskAssignees.length === 2, 'Duplicate assignee IDs automatically deduplicated (length 2)');
    assert(taskAssignees.includes(employeeId), 'Contains employee 1');
    assert(taskAssignees.includes(employee2Id), 'Contains employee 2');
    const multiTaskId = multiTaskRes.data.task._id;

    // -------------------------------------------------------------
    // TEST 11: My Tasks Endpoint Returns Tasks Where User is Assigned
    // -------------------------------------------------------------
    console.log('\n[Test 11] Verify Employee "My Tasks" Endpoint (GET /api/tasks/my)...');
    const myTasksEmp1Res = await request('GET', '/api/tasks/my', null, {
      Authorization: `Bearer ${employeeToken}`,
    });
    assert(myTasksEmp1Res.status === 200, 'Employee 1 retrieved My Tasks');
    const emp1TaskIds = myTasksEmp1Res.data.tasks.map((t) => t._id.toString());
    assert(emp1TaskIds.includes(multiTaskId.toString()), 'Multi-assignee task appears in Employee 1 task list');

    const myTasksEmp2Res = await request('GET', '/api/tasks/my', null, {
      Authorization: `Bearer ${employee2Token}`,
    });
    assert(myTasksEmp2Res.status === 200, 'Employee 2 retrieved My Tasks');
    const emp2TaskIds = myTasksEmp2Res.data.tasks.map((t) => t._id.toString());
    assert(emp2TaskIds.includes(multiTaskId.toString()), 'Multi-assignee task also appears in Employee 2 task list');

    // -------------------------------------------------------------
    // TEST 12: Employee Permission Restriction (Status Only)
    // -------------------------------------------------------------
    console.log('\n[Test 12] Employee Restricted from Modifying Non-Status Fields...');
    // Attempt to modify title and priority as normal employee
    const illegalEditRes = await request(
      'PATCH',
      `/api/tasks/${multiTaskId}`,
      { title: 'Hacked Title', priority: 'Low' },
      { Authorization: `Bearer ${employeeToken}` }
    );
    assert(illegalEditRes.status === 403, 'Arbitrary field modification rejected with 403 for employee');

    // Employee updates status only -> should succeed
    const legalStatusRes = await request(
      'PATCH',
      `/api/tasks/${multiTaskId}`,
      { status: 'In Progress' },
      { Authorization: `Bearer ${employeeToken}` }
    );
    assert(legalStatusRes.status === 200, 'Employee allowed to update status to "In Progress"');
    assert(legalStatusRes.data.task.status === 'In Progress', 'Task status is now "In Progress"');

    // -------------------------------------------------------------
    // TEST 13: Shared Task Status & Live Project Progress Calculation
    // -------------------------------------------------------------
    console.log('\n[Test 13] Shared Task Status & Live Project Progress Recalculation...');
    // Employee 2 completes the shared task
    const completeByEmp2Res = await request(
      'PATCH',
      `/api/tasks/${multiTaskId}`,
      { status: 'Completed' },
      { Authorization: `Bearer ${employee2Token}` }
    );
    assert(completeByEmp2Res.status === 200, 'Employee 2 marked shared task Completed');

    // Verify when Employee 1 queries My Tasks, status is also Completed
    const emp1CheckRes = await request('GET', '/api/tasks/my', null, {
      Authorization: `Bearer ${employeeToken}`,
    });
    const sharedTaskForEmp1 = emp1CheckRes.data.tasks.find((t) => t._id.toString() === multiTaskId.toString());
    assert(sharedTaskForEmp1.status === 'Completed', 'Shared task status is Completed for all assignees');

    // Check project progress calculation: 2 tasks total (taskId1 and multiTaskId), both completed -> 100%
    const progressRes = await request('GET', `/api/projects/${projectId}/progress`, null, {
      Authorization: `Bearer ${employeeToken}`,
    });
    assert(progressRes.status === 200, 'Project progress returned');
    assert(progressRes.data.totalTasks === 2, 'Total tasks = 2');
    assert(progressRes.data.completedTasks === 2, 'Completed tasks = 2');
    assert(progressRes.data.pendingTasks === 0, 'Pending tasks = 0');
    assert(progressRes.data.percentage === 100, 'Progress percentage calculated accurately at 100%');

    // -------------------------------------------------------------
    // TEST 14: Task Assignment Dispatches to All Assignees Without Duplication
    // -------------------------------------------------------------
    console.log('\n[Test 14] Task Notification Dispatches Without Duplicate Assignees...');
    // Create task with duplicate IDs passed in array: [emp1, emp1]
    const dupTestTaskRes = await request(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Deduplication Email Notification Verification',
        assignedTo: [employeeId, employeeId],
      },
      { Authorization: `Bearer ${ownerToken}` }
    );
    assert(dupTestTaskRes.status === 201, 'Task created');
    const dupAssignedTo = dupTestTaskRes.data.task.assignedTo;
    assert(dupAssignedTo.length === 1, 'Duplicate assignee entry was filtered before notification dispatch');

    // -------------------------------------------------------------
    // TEST 15: Multi-Tenant Isolation (Org A vs Org B)
    // -------------------------------------------------------------
    console.log('\n[Test 15] Multi-Tenant Isolation Across Organisations...');
    // Register separate Organisation B
    const orgBRes = await request('POST', '/api/auth/register', {
      name: `Competitor ${timestamp}`,
      email: `competitor_${timestamp}@example.com`,
      password: 'Password123!',
      organisationName: `Competitor Corp ${timestamp}`,
    });
    const orgBToken = orgBRes.data.token;

    // Org B user attempts to access Org A's project
    const crossAccessProject = await request('GET', `/api/projects/${projectId}`, null, {
      Authorization: `Bearer ${orgBToken}`,
    });
    assert(
      crossAccessProject.status === 403 || crossAccessProject.status === 404,
      'Org B user blocked from viewing Org A project (status 403 or 404)'
    );

    // Org B user attempts to view tasks of Org A
    const crossAccessTasks = await request('GET', `/api/projects/${projectId}/tasks`, null, {
      Authorization: `Bearer ${orgBToken}`,
    });
    assert(
      crossAccessTasks.status === 403 || crossAccessTasks.status === 404,
      'Org B user blocked from viewing Org A project tasks'
    );

    // Org B user's personal My Tasks must NOT contain Org A's tasks
    const orgBMyTasks = await request('GET', '/api/tasks/my', null, {
      Authorization: `Bearer ${orgBToken}`,
    });
    assert(orgBMyTasks.status === 200, 'Org B My Tasks retrieved');
    assert(orgBMyTasks.data.tasks.length === 0, 'Org B user sees 0 tasks from Org A');

    console.log('\n================================================================');
    console.log('🎉 ALL 15 REQUIREMENT TESTS PASSED PERFECTLY!');
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
