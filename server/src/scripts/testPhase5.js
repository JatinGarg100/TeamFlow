const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

const runPhase5Tests = async () => {
  console.log('=== Starting Phase 5 Tasks & Progress Verification ===');
  await connectDB();

  const server = app.listen(5097, async () => {
    const baseUrl = 'http://localhost:5097';

    try {
      // 1. Setup Organisation & Owner
      const ownerEmail = `owner_p5_${Date.now()}@teamflow.io`;
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Manager Megan',
          email: ownerEmail,
          password: 'Password123!',
          organisationName: 'Apex Dynamics',
        }),
      });
      const regData = await regRes.json();
      const token = regData.token;
      const orgId = regData.organisation.id;

      // 2. Add two employees to Apex Dynamics
      const emp1Res = await fetch(`${baseUrl}/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Dev Liam',
          email: `liam_${Date.now()}@teamflow.io`,
          role: 'member',
        }),
      });
      const emp1Data = await emp1Res.json();
      const emp1UserId = emp1Data.member.userId;

      const emp2Res = await fetch(`${baseUrl}/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Designer Zoe',
          email: `zoe_${Date.now()}@teamflow.io`,
          role: 'member',
        }),
      });
      const emp2Data = await emp2Res.json();
      const emp2UserId = emp2Data.member.userId;

      // 3. Create a Project and assign the two employees
      console.log('\n[Step 1] Creating project with 2 assigned employees...');
      const projectRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Customer Portal',
          description: 'Self-service client portal with billing.',
          status: 'In Progress',
          orgId,
          teamMembers: [emp1UserId, emp2UserId],
        }),
      });
      const projectData = await projectRes.json();
      const projectId = projectData.project._id;
      console.log('Project created ID:', projectId);

      // Verify 0 tasks progress initially is 0%
      const initProgressRes = await fetch(`${baseUrl}/api/projects/${projectId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const initProgressData = await initProgressRes.json();
      console.log('Initial progress with 0 tasks:', `${initProgressData.percentage}% (Expected: 0%)`);
      if (initProgressData.percentage !== 0) throw new Error('Initial progress should be 0%');

      // 4. Test assigning outsider (not in project team) fails
      console.log('\n[Step 2] Testing assignment rule (assigning outsider not in project team)...');
      // Create outsider user in another org
      const outsiderRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Outsider Oliver',
          email: `oliver_${Date.now()}@teamflow.io`,
          password: 'Password123!',
          organisationName: 'Other Company',
        }),
      });
      const outsiderData = await outsiderRes.json();
      const outsiderUserId = outsiderData.user.id;

      const badAssignRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: 'Invalid Task',
          assignedTo: outsiderUserId,
        }),
      });
      console.log('Bad assign status:', badAssignRes.status, 'Expected: 400');
      if (badAssignRes.status !== 400) throw new Error('Assigned outsider was not rejected');

      // 5. Add 4 tasks to the project
      console.log('\n[Step 3] Adding 4 tasks to Customer Portal...');
      const tasksToCreate = [
        { title: 'Task 1: Setup Wireframes', assignedTo: emp2UserId, status: 'Completed', priority: 'High' },
        { title: 'Task 2: Database Schema', assignedTo: emp1UserId, status: 'Completed', priority: 'High' },
        { title: 'Task 3: Stripe Integration', assignedTo: emp1UserId, status: 'In Progress', priority: 'Medium' },
        { title: 'Task 4: User Acceptance Testing', assignedTo: emp2UserId, status: 'To Do', priority: 'Low' },
      ];

      const createdTasks = [];
      for (const t of tasksToCreate) {
        const res = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(t),
        });
        const d = await res.json();
        if (res.status !== 201) throw new Error(`Failed to create ${t.title}: ${d.error?.message}`);
        createdTasks.push(d.task);
      }
      console.log('Successfully created 4 tasks. (2 Completed, 2 Pending)');

      // 6. Test Scenario Verification: 2 completed out of 4 tasks = 50%
      console.log('\n[Step 4] Checking progress endpoint: 2 Completed out of 4 Tasks...');
      const p1Res = await fetch(`${baseUrl}/api/projects/${projectId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const p1Data = await p1Res.json();
      console.log(`Progress Data: Total=${p1Data.totalTasks}, Completed=${p1Data.completedTasks}, Pending=${p1Data.pendingTasks}, Percentage=${p1Data.percentage}%`);
      if (p1Data.totalTasks !== 4 || p1Data.completedTasks !== 2 || p1Data.percentage !== 50) {
        throw new Error(`Expected 50%, got ${p1Data.percentage}%`);
      }
      console.log('✅ Verified: Progress is exactly 50%!');

      // 7. Update another task to Completed (Task 3: Stripe Integration)
      console.log('\n[Step 5] Marking Task 3 as "Completed" via PATCH /api/tasks/:taskId...');
      const task3 = createdTasks[2];
      const patchRes = await fetch(`${baseUrl}/api/tasks/${task3._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Completed' }),
      });
      const patchData = await patchRes.json();
      console.log('Task 3 updated status:', patchData.task?.status);
      if (patchRes.status !== 200 || patchData.task?.status !== 'Completed') {
        throw new Error('Task 3 update failed');
      }

      // 8. Test Scenario Verification: 3 completed out of 4 tasks = 75%
      console.log('\n[Step 6] Re-verifying progress endpoint: 3 Completed out of 4 Tasks...');
      const p2Res = await fetch(`${baseUrl}/api/projects/${projectId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const p2Data = await p2Res.json();
      console.log(`Progress Data: Total=${p2Data.totalTasks}, Completed=${p2Data.completedTasks}, Pending=${p2Data.pendingTasks}, Percentage=${p2Data.percentage}%`);
      if (p2Data.totalTasks !== 4 || p2Data.completedTasks !== 3 || p2Data.percentage !== 75) {
        throw new Error(`Expected 75%, got ${p2Data.percentage}%`);
      }
      console.log('✅ Verified: Progress successfully updated to 75%!');

      // 9. Employee role security test:
      // Login as Dev Liam (member)
      console.log('\n[Step 7] Testing employee permission restrictions...');
      const liamLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emp1Data.member.email,
          password: 'TempPassword123!',
        }),
      });
      const liamLoginData = await liamLoginRes.json();
      const liamToken = liamLoginData.token;

      // Liam tries to create a task (must fail with 403 Forbidden because Liam is a member, not manager)
      const liamCreateTaskRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${liamToken}`,
        },
        body: JSON.stringify({ title: 'Unauthorized Task' }),
      });
      console.log('Liam create task status:', liamCreateTaskRes.status, 'Expected: 403');
      if (liamCreateTaskRes.status !== 403) throw new Error('Normal member was not blocked from creating task');

      // Liam updates status of Task 2 (which is assigned to him) -> should succeed
      const task2 = createdTasks[1];
      const liamUpdateOwnRes = await fetch(`${baseUrl}/api/tasks/${task2._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${liamToken}`,
        },
        body: JSON.stringify({ status: 'In Progress' }),
      });
      console.log('Liam updating his assigned task status:', liamUpdateOwnRes.status, 'Expected: 200');
      if (liamUpdateOwnRes.status !== 200) throw new Error('Employee could not update own task status');

      // Liam tries to change the title of Task 2 (must fail with 403)
      const liamUpdateTitleRes = await fetch(`${baseUrl}/api/tasks/${task2._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${liamToken}`,
        },
        body: JSON.stringify({ title: 'Hacked Title' }),
      });
      console.log('Liam updating non-status field:', liamUpdateTitleRes.status, 'Expected: 403');
      if (liamUpdateTitleRes.status !== 403) throw new Error('Employee was able to update non-status field');

      console.log('\n======================================================');
      console.log('🎉 ALL PHASE 5 BACKEND INTEGRATION TESTS PASSED! 🎉');
      console.log('======================================================\n');
    } catch (err) {
      console.error('❌ Phase 5 Test Error:', err.message);
    } finally {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    }
  });
};

runPhase5Tests();
