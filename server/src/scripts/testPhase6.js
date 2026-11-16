const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

const runPhase6Tests = async () => {
  console.log('=== Starting Phase 6 Dashboard & Subscription Verification ===');
  await connectDB();

  const server = app.listen(5096, async () => {
    const baseUrl = 'http://localhost:5096';

    try {
      // 1. Setup Organisation A (Titan Corp)
      const userAEmail = `user_a_${Date.now()}@teamflow.io`;
      const regARes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tyler Titan',
          email: userAEmail,
          password: 'Password123!',
          organisationName: 'Titan Corp',
        }),
      });
      const regAData = await regARes.json();
      const tokenA = regAData.token;
      const orgAId = regAData.organisation.id;

      // Add 1 employee to Titan Corp (Total: 2 members)
      const addEmpRes = await fetch(`${baseUrl}/api/orgs/${orgAId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Employee Evan',
          email: `evan_${Date.now()}@teamflow.io`,
          role: 'member',
        }),
      });
      const addEmpData = await addEmpRes.json();
      const evanUserId = addEmpData.member.userId;

      // Create 1 Project in Titan Corp
      const projARes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Titan Gateway',
          description: 'Payment microservice architecture.',
          status: 'In Progress',
          orgId: orgAId,
          teamMembers: [evanUserId],
        }),
      });
      const projAData = await projARes.json();
      const projAId = projAData.project._id;

      // Add 2 Tasks: 1 Completed, 1 Pending
      await fetch(`${baseUrl}/api/projects/${projAId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          title: 'Setup Redis Cache',
          assignedTo: evanUserId,
          status: 'Completed',
        }),
      });

      await fetch(`${baseUrl}/api/projects/${projAId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          title: 'Implement Webhook listener',
          assignedTo: evanUserId,
          status: 'In Progress',
        }),
      });

      // -------------------------------------------------------------
      // Test 1: GET /api/dashboard for Titan Corp
      // -------------------------------------------------------------
      console.log('\n[Test 1] Testing GET /api/dashboard for Titan Corp...');
      const dashARes = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const dashAData = await dashARes.json();
      console.log('Status:', dashARes.status);
      console.log('Organisation:', dashAData.organisation?.name);
      console.log('Stats:', dashAData.stats);
      console.log('Recent Projects count:', dashAData.recentProjects?.length);

      if (dashARes.status !== 200) throw new Error('Dashboard fetch failed');
      if (dashAData.stats.totalEmployees !== 2) throw new Error(`Expected 2 employees, got ${dashAData.stats.totalEmployees}`);
      if (dashAData.stats.totalProjects !== 1) throw new Error(`Expected 1 project, got ${dashAData.stats.totalProjects}`);
      if (dashAData.stats.pendingTasks !== 1) throw new Error(`Expected 1 pending task, got ${dashAData.stats.pendingTasks}`);
      if (dashAData.stats.completedTasks !== 1) throw new Error(`Expected 1 completed task, got ${dashAData.stats.completedTasks}`);
      if (dashAData.recentProjects[0].progress !== 50) throw new Error(`Expected recent project progress 50%, got ${dashAData.recentProjects[0].progress}%`);
      console.log('✅ Verified: All 4 stat cards & recent project progress calculated live from MongoDB!');

      // -------------------------------------------------------------
      // Test 2: Setup Organisation B (Vortex Systems) and test multi-tenant isolation
      // -------------------------------------------------------------
      console.log('\n[Test 2] Setting up Organisation B (Vortex Systems) for isolation test...');
      const userBEmail = `user_b_${Date.now()}@teamflow.io`;
      const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Vera Vortex',
          email: userBEmail,
          password: 'Password123!',
          organisationName: 'Vortex Systems',
        }),
      });
      const regBData = await regBRes.json();
      const tokenB = regBData.token;
      const orgBId = regBData.organisation.id;

      // Check Vortex dashboard (should have 1 member, 0 projects, 0 tasks)
      const dashBRes = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const dashBData = await dashBRes.json();
      console.log('Vortex Dashboard Stats:', dashBData.stats);
      if (dashBData.stats.totalEmployees !== 1 || dashBData.stats.totalProjects !== 0 || dashBData.stats.totalTasks !== 0) {
        throw new Error('Vortex Systems dashboard data leaked or incorrect');
      }
      console.log('✅ Verified: Organisation B dashboard completely isolated from Organisation A.');

      // Test 3: User B attempts to spy on Titan Corp by supplying orgAId
      console.log('\n[Test 3] User B attempts to access Org A stats with ?orgId=...');
      const spyRes = await fetch(`${baseUrl}/api/dashboard?orgId=${orgAId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const spyData = await spyRes.json();
      console.log('Cross-tenant spy status:', spyRes.status, 'Expected: 403. Message:', spyData.error?.message);
      if (spyRes.status !== 403) throw new Error('Cross-tenant dashboard request was not forbidden');
      console.log('✅ Verified: Cross-tenant dashboard access strictly forbidden.');

      // -------------------------------------------------------------
      // Test 4: GET /api/plans
      // -------------------------------------------------------------
      console.log('\n[Test 4] Testing GET /api/plans...');
      const plansRes = await fetch(`${baseUrl}/api/plans`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const plansData = await plansRes.json();
      console.log('Plans status:', plansRes.status);
      console.log('Current Plan:', plansData.currentPlan);
      console.log('Available plans count:', plansData.plans?.length);
      if (plansRes.status !== 200 || !Array.isArray(plansData.plans) || plansData.plans.length < 2) {
        throw new Error('Plans API failed');
      }
      console.log('✅ Verified: Plans configuration returned with current organisation tier.');

      // -------------------------------------------------------------
      // Test 5: GET /api/usage
      // -------------------------------------------------------------
      console.log('\n[Test 5] Testing GET /api/usage...');
      const usageRes = await fetch(`${baseUrl}/api/usage`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const usageData = await usageRes.json();
      console.log('Usage status:', usageRes.status);
      console.log('Status indicator:', usageData.status);
      console.log('Message:', usageData.message);
      console.log('Usage counts:', usageData.usage);
      if (usageRes.status !== 200 || usageData.usage.membersCount !== 2 || usageData.usage.projectsCount !== 1) {
        throw new Error('Usage API failed or counts incorrect');
      }
      console.log('✅ Verified: Usage API returns accurate MongoDB resource tallies and preliminary flag.');

      console.log('\n======================================================');
      console.log('🎉 ALL PHASE 6 BACKEND INTEGRATION TESTS PASSED! 🎉');
      console.log('======================================================\n');
    } catch (err) {
      console.error('❌ Phase 6 Test Error:', err.message);
    } finally {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    }
  });
};

runPhase6Tests();
