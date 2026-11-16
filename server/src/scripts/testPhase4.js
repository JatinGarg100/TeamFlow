const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');
const { User, Organisation, Membership, Project } = require('../models');

const runPhase4Tests = async () => {
  console.log('=== Starting Phase 4 Project Management Verification ===');
  await connectDB();

  const server = app.listen(5098, async () => {
    const baseUrl = 'http://localhost:5098';

    try {
      // Setup Org A (Owner A, Member A1, Member A2)
      const ownerEmail = `owner_a_${Date.now()}@teamflow.io`;
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Owner',
          email: ownerEmail,
          password: 'Password123!',
          organisationName: 'Alpha Corp',
        }),
      });
      const regData = await regRes.json();
      const tokenA = regData.token;
      const orgAId = regData.organisation.id;
      const ownerAId = regData.user.id;

      // Add two employees to Org A
      const emp1Res = await fetch(`${baseUrl}/api/orgs/${orgAId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Developer Dave',
          email: `dave_${Date.now()}@teamflow.io`,
          role: 'member',
        }),
      });
      const emp1Data = await emp1Res.json();
      const emp1Id = emp1Data.member.userId;

      const emp2Res = await fetch(`${baseUrl}/api/orgs/${orgAId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Designer Diana',
          email: `diana_${Date.now()}@teamflow.io`,
          role: 'member',
        }),
      });
      const emp2Data = await emp2Res.json();
      const emp2Id = emp2Data.member.userId;

      // Setup Org B (Different Company & Owner)
      const ownerBRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bob Competitor',
          email: `bob_competitor_${Date.now()}@teamflow.io`,
          password: 'Password123!',
          organisationName: 'Beta Inc',
        }),
      });
      const ownerBData = await ownerBRes.json();
      const tokenB = ownerBData.token;
      const orgBId = ownerBData.organisation.id;

      // ---------------------------------------------------------------
      // Test 1: Unauthenticated request must be blocked (401)
      // ---------------------------------------------------------------
      console.log('\n[Test 1] Unauthenticated GET /api/projects...');
      const unauthRes = await fetch(`${baseUrl}/api/projects`);
      console.log('Status:', unauthRes.status, 'Expected: 401');
      if (unauthRes.status !== 401) throw new Error('Unauthenticated request was not blocked');

      // ---------------------------------------------------------------
      // Test 2: Validation check - Missing or short project name (400)
      // ---------------------------------------------------------------
      console.log('\n[Test 2] Invalid project name validation...');
      const badNameRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ name: ' ' }),
      });
      const badNameData = await badNameRes.json();
      console.log('Status:', badNameRes.status, 'Expected: 400. Message:', badNameData.error?.message);
      if (badNameRes.status !== 400) throw new Error('Validation failed to catch empty name');

      // ---------------------------------------------------------------
      // Test 3: Assigning a user from ANOTHER organisation must fail (400)
      // ---------------------------------------------------------------
      console.log('\n[Test 3] Assigning outsider employee from another company...');
      const fakeAssignRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Secret Project',
          orgId: orgAId,
          teamMembers: [ownerBData.user.id], // User belongs to Org B, not Org A!
        }),
      });
      const fakeAssignData = await fakeAssignRes.json();
      console.log('Status:', fakeAssignRes.status, 'Expected: 400. Message:', fakeAssignData.error?.message);
      if (fakeAssignRes.status !== 400) throw new Error('Failed to block assignment of outsider member');

      // ---------------------------------------------------------------
      // Test 4: Create Project "Company Website" with 2 assigned employees
      // ---------------------------------------------------------------
      console.log('\n[Test 4] Creating project "Company Website" with 2 assigned employees...');
      const createRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          name: 'Company Website',
          description: 'Modern corporate website redesign with SaaS portal.',
          deadline: '2026-12-30',
          status: 'In Progress',
          orgId: orgAId,
          teamMembers: [emp1Id, emp2Id],
        }),
      });
      const createData = await createRes.json();
      console.log('Status:', createRes.status, 'Created ID:', createData.project?._id);
      console.log('Project Name:', createData.project?.name);
      console.log('Assigned count:', createData.project?.teamMembers?.length);
      console.log('Created By User:', createData.project?.createdBy?.name);

      if (createRes.status !== 201) throw new Error('Project creation failed');
      const projectAId = createData.project._id;

      // ---------------------------------------------------------------
      // Test 5: Verify project in GET /api/projects
      // ---------------------------------------------------------------
      console.log('\n[Test 5] Fetching project list via GET /api/projects...');
      const listRes = await fetch(`${baseUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const listData = await listRes.json();
      console.log('Projects count for Org A:', listData.count);
      const foundProject = listData.projects.find((p) => p._id === projectAId);
      if (!foundProject) throw new Error('Created project not found in list');
      console.log('Verified: Project appears in Org A list.');

      // ---------------------------------------------------------------
      // Test 6: Verify direct lookup via GET /api/projects/:projectId
      // ---------------------------------------------------------------
      console.log(`\n[Test 6] Fetching project details via GET /api/projects/${projectAId}...`);
      const getSingleRes = await fetch(`${baseUrl}/api/projects/${projectAId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const getSingleData = await getSingleRes.json();
      console.log('Single fetch status:', getSingleRes.status, 'Name:', getSingleData.project?.name);
      if (getSingleRes.status !== 200) throw new Error('Single project lookup failed');

      // ---------------------------------------------------------------
      // Test 7: Rule 7: Prevent user from Org B from accessing Org A project by ID
      // ---------------------------------------------------------------
      console.log(`\n[Test 7] Competitor from Org B tries to access Org A project (${projectAId})...`);
      const crossOrgRes = await fetch(`${baseUrl}/api/projects/${projectAId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const crossOrgData = await crossOrgRes.json();
      console.log('Cross-org access status:', crossOrgRes.status, 'Expected: 403. Message:', crossOrgData.error?.message);
      if (crossOrgRes.status !== 403) throw new Error('Cross-organisation access was not forbidden');

      // ---------------------------------------------------------------
      // Test 8: PATCH /api/projects/:projectId (Update status & description)
      // ---------------------------------------------------------------
      console.log(`\n[Test 8] Updating project status to "Completed"...`);
      const patchRes = await fetch(`${baseUrl}/api/projects/${projectAId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          status: 'Completed',
          description: 'Launched successfully to production.',
        }),
      });
      const patchData = await patchRes.json();
      console.log('Patch status:', patchRes.status, 'New status:', patchData.project?.status);
      if (patchRes.status !== 200 || patchData.project?.status !== 'Completed') {
        throw new Error('Project update failed');
      }

      console.log('\n======================================================');
      console.log('🎉 ALL 8 PHASE 4 BACKEND INTEGRATION TESTS PASSED! 🎉');
      console.log('======================================================\n');
    } catch (err) {
      console.error('❌ Phase 4 Test Error:', err.message);
    } finally {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    }
  });
};

runPhase4Tests();
