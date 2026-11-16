const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');

const runTests = async () => {
  console.log('--- Starting Phase 3 Backend Verification ---');
  await connectDB();

  const server = app.listen(5099, async () => {
    const baseUrl = 'http://localhost:5099';

    try {
      // 1. Test registration
      const testEmail = `testuser_${Date.now()}@teamflow.io`;
      console.log(`[Test 1] Registering user: ${testEmail}`);
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe',
          email: testEmail,
          password: 'Password123!',
          organisationName: 'Innovate Labs',
        }),
      });
      const regData = await regRes.json();
      console.log('Status:', regRes.status, 'Success:', regData.success);
      if (regRes.status !== 201) throw new Error('Registration failed');

      const { token, organisation } = regData;
      const orgId = organisation.id;

      // 2. Test duplicate registration prevention
      console.log('[Test 2] Duplicate registration check...');
      const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Doe Duplicate',
          email: testEmail,
          password: 'Password123!',
        }),
      });
      const dupData = await dupRes.json();
      console.log('Duplicate status:', dupRes.status, 'Expected: 409. Result:', dupData.error?.message);
      if (dupRes.status !== 409) throw new Error('Duplicate check failed');

      // 3. Test invalid login
      console.log('[Test 3] Invalid login attempt...');
      const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' }),
      });
      console.log('Bad login status:', badLoginRes.status, 'Expected: 401');
      if (badLoginRes.status !== 401) throw new Error('Bad login check failed');

      // 4. Test valid login
      console.log('[Test 4] Valid login attempt...');
      const goodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'Password123!' }),
      });
      const goodLoginData = await goodLoginRes.json();
      console.log('Good login status:', goodLoginRes.status, 'User:', goodLoginData.user?.email);
      if (goodLoginRes.status !== 200) throw new Error('Login failed');

      // 5. Test GET /api/auth/me
      console.log('[Test 5] Fetch current user (/api/auth/me)...');
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meRes.json();
      console.log('Me status:', meRes.status, 'User Name:', meData.user?.name, 'Orgs:', meData.organisations?.length);
      if (meRes.status !== 200) throw new Error('Get Me failed');

      // 6. Test GET members
      console.log('[Test 6] Fetch organisation members...');
      const membersRes = await fetch(`${baseUrl}/api/orgs/${orgId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const membersData = await membersRes.json();
      console.log('Members status:', membersRes.status, 'Member count:', membersData.count);
      if (membersRes.status !== 200) throw new Error('Get members failed');

      // 7. Test POST /api/orgs/:orgId/members (Add Employee)
      const empEmail = `employee_${Date.now()}@teamflow.io`;
      console.log(`[Test 7] Adding new employee: ${empEmail}`);
      const addEmpRes = await fetch(`${baseUrl}/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Bob Smith',
          email: empEmail,
          role: 'member',
        }),
      });
      const addEmpData = await addEmpRes.json();
      console.log('Add member status:', addEmpRes.status, 'Added:', addEmpData.member?.name);
      if (addEmpRes.status !== 201) throw new Error('Add member failed');

      // 8. Test duplicate member in same org
      console.log('[Test 8] Prevent duplicate employee in organisation...');
      const dupEmpRes = await fetch(`${baseUrl}/api/orgs/${orgId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Bob Smith Again',
          email: empEmail,
          role: 'member',
        }),
      });
      const dupEmpData = await dupEmpRes.json();
      console.log('Duplicate employee status:', dupEmpRes.status, 'Expected: 409. Result:', dupEmpData.error?.message);
      if (dupEmpRes.status !== 409) throw new Error('Duplicate employee check failed');

      console.log('\n🎉 ALL 8 BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');
    } catch (err) {
      console.error('❌ Test failed:', err.message);
    } finally {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    }
  });
};

runTests();
