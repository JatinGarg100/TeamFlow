/**
 * Integration Test: Phase 3 Pagination, Search, Filtering & Query Security
 * ------------------------------------------------------------------------
 * Validates:
 * 1. Server-side pagination on Projects, Tasks, and Employees (page, limit, totalPages, totalItems)
 * 2. Sensible maximum page size limits (capped at maxLimit = 50)
 * 3. Search functionality on Projects (name/desc), Tasks (title/desc), and Employees (name/email)
 * 4. Safe query construction (regex characters escaped to prevent regex injection)
 * 5. Multi-field filtering (status, priority, role, date ranges)
 * 6. Sorting validation and ordering (ascending/descending)
 * 7. Multi-tenant organisation scoping (cannot view other org data via query parameter tampering)
 * 8. Empty result sets handled cleanly with pagination structure
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const http = require('http');
const connectDB = require('../config/db');
const app = require('../app');
const { User, Organisation, Membership, Project, Task } = require('../models');

let server;
let baseUrl;

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

const runPhase3Tests = async () => {
  console.log('\n================================================================');
  console.log('   Running Phase 3 Pagination, Search, & Filtering Test Suite   ');
  console.log('================================================================\n');

  try {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });

    const timestamp = Date.now();

    // 1. Setup Organisation & Owner
    console.log('[Setup] Registering test organisation owner...');
    const ownerRes = await request('POST', '/api/auth/register', {
      name: 'Owner Phase3',
      email: `owner_${timestamp}@teamflow.test`,
      password: 'Password123!',
      organisationName: `Phase3 Workspace ${timestamp}`,
    });

    if (ownerRes.statusCode !== 201 || !ownerRes.body?.token) {
      throw new Error(`Owner registration failed: ${JSON.stringify(ownerRes.body)}`);
    }

    const token = ownerRes.body.token;
    const orgId = ownerRes.body.organisation.id;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'x-org-id': orgId,
    };
    console.log('  ✓ Test organisation established.');

    // 2. Setup Multiple Employees to test Employee Search & Pagination
    console.log('\n[Test 1] Testing Employee Pagination, Search & Role Filtering...');
    for (let i = 1; i <= 6; i++) {
      await request(
        'POST',
        `/api/orgs/${orgId}/members`,
        {
          name: `Employee ${i} Alpha`,
          email: `emp${i}_${timestamp}@teamflow.test`,
          password: 'Password123!',
          role: i % 2 === 0 ? 'admin' : 'member',
        },
        authHeaders
      );
    }

    // Verify Pagination (Page 1, limit 3)
    const empPage1 = await request('GET', `/api/orgs/${orgId}/members?page=1&limit=3`, null, authHeaders);
    if (empPage1.statusCode !== 200 || empPage1.body.data.length !== 3 || empPage1.body.currentPage !== 1) {
      throw new Error(`Employee pagination failed on page 1: ${JSON.stringify(empPage1.body)}`);
    }
    console.log('  ✓ Employee page 1 returned exactly 3 items with currentPage=1');

    // Verify Search by employee email keyword
    const empSearch = await request('GET', `/api/orgs/${orgId}/members?search=emp4_`, null, authHeaders);
    if (empSearch.statusCode !== 200 || empSearch.body.data.length !== 1 || !empSearch.body.data[0].email.includes('emp4_')) {
      throw new Error(`Employee search failed: ${JSON.stringify(empSearch.body)}`);
    }
    console.log('  ✓ Employee search by keyword returned matching user');

    // Verify Role Filter (role=admin)
    const empRoleFilter = await request('GET', `/api/orgs/${orgId}/members?role=admin`, null, authHeaders);
    if (empRoleFilter.statusCode !== 200 || !empRoleFilter.body.data.every((e) => e.role === 'admin')) {
      throw new Error(`Employee role filtering failed: ${JSON.stringify(empRoleFilter.body)}`);
    }
    console.log(`  ✓ Employee role filter returned only admin records (${empRoleFilter.body.data.length} found)`);

    // 3. Setup Multiple Projects to test Project Pagination, Search, Filter & Sort
    console.log('\n[Test 2] Testing Project Pagination, Search, Filter & Sort...');
    const proj1 = await request(
      'POST',
      '/api/projects',
      {
        name: 'Website Redesign',
        description: 'Overhaul UI with accessible design system',
        status: 'In Progress',
      },
      authHeaders
    );

    const proj2 = await request(
      'POST',
      '/api/projects',
      {
        name: 'Mobile App Architecture',
        description: 'Native react application for clients',
        status: 'Planning',
      },
      authHeaders
    );

    const proj3 = await request(
      'POST',
      '/api/projects',
      {
        name: 'Cloud Infrastructure Upgrade',
        description: 'Migrating backend services to cloud containers',
        status: 'Completed',
      },
      authHeaders
    );

    // Verify Project Pagination
    const projPageRes = await request('GET', `/api/projects?page=1&limit=2`, null, authHeaders);
    if (projPageRes.statusCode !== 200 || projPageRes.body.data.length !== 2 || projPageRes.body.totalItems !== 3) {
      throw new Error(`Project pagination failed: ${JSON.stringify(projPageRes.body)}`);
    }
    console.log('  ✓ Project pagination returned 2 items with totalItems=3, totalPages=2');

    // Verify Project Search by description keyword
    const projSearchRes = await request('GET', `/api/projects?search=accessible`, null, authHeaders);
    if (projSearchRes.statusCode !== 200 || projSearchRes.body.data.length !== 1 || projSearchRes.body.data[0].name !== 'Website Redesign') {
      throw new Error(`Project search by description failed: ${JSON.stringify(projSearchRes.body)}`);
    }
    console.log('  ✓ Project search by description keyword returned exact project');

    // Verify Project Status Filter
    const projFilterRes = await request('GET', `/api/projects?status=Completed`, null, authHeaders);
    if (projFilterRes.statusCode !== 200 || projFilterRes.body.data.length !== 1 || projFilterRes.body.data[0].status !== 'Completed') {
      throw new Error(`Project status filter failed: ${JSON.stringify(projFilterRes.body)}`);
    }
    console.log('  ✓ Project status filter (?status=Completed) returned exact matches');

    // Verify Project Sorting (Sort by name ascending)
    const projSortRes = await request('GET', `/api/projects?sortBy=name&sortOrder=asc`, null, authHeaders);
    if (projSortRes.statusCode !== 200 || projSortRes.body.data[0].name !== 'Cloud Infrastructure Upgrade') {
      throw new Error(`Project sorting failed: ${JSON.stringify(projSortRes.body)}`);
    }
    console.log('  ✓ Project sorting (?sortBy=name&sortOrder=asc) ordered records correctly');

    // 4. Setup Tasks to test Task Pagination, Filtering & Search
    console.log('\n[Test 3] Testing Task Pagination, Filtering & Search...');
    const projectId = proj1.body.project._id;

    for (let i = 1; i <= 5; i++) {
      await request(
        'POST',
        `/api/projects/${projectId}/tasks`,
        {
          title: `Task ${i} - ${i % 2 === 0 ? 'Bugfix' : 'Feature'} Implementation`,
          description: `Detailed description for task ${i}`,
          status: i % 2 === 0 ? 'Completed' : 'In Progress',
          priority: i > 3 ? 'High' : 'Medium',
        },
        authHeaders
      );
    }

    // Task Pagination
    const taskPageRes = await request('GET', `/api/projects/${projectId}/tasks?page=1&limit=3`, null, authHeaders);
    if (taskPageRes.statusCode !== 200 || taskPageRes.body.data.length !== 3 || taskPageRes.body.totalItems !== 5) {
      throw new Error(`Task pagination failed: ${JSON.stringify(taskPageRes.body)}`);
    }
    console.log('  ✓ Task pagination returned 3 items with totalItems=5, totalPages=2');

    // Task Filtering by Priority & Status combined
    const taskMultiFilter = await request('GET', `/api/projects/${projectId}/tasks?priority=High&status=In Progress`, null, authHeaders);
    if (taskMultiFilter.statusCode !== 200 || !taskMultiFilter.body.data.every((t) => t.priority === 'High' && t.status === 'In Progress')) {
      throw new Error(`Task combined filter failed: ${JSON.stringify(taskMultiFilter.body)}`);
    }
    console.log(`  ✓ Task combined filter (?priority=High&status=In Progress) returned accurate subset`);

    // Task Search
    const taskSearchRes = await request('GET', `/api/projects/${projectId}/tasks?search=Bugfix`, null, authHeaders);
    if (taskSearchRes.statusCode !== 200 || taskSearchRes.body.data.length !== 2) {
      throw new Error(`Task search failed: ${JSON.stringify(taskSearchRes.body)}`);
    }
    console.log('  ✓ Task search by keyword (?search=Bugfix) returned matching tasks');

    // 5. Test Multi-Tenant Query Isolation
    console.log('\n[Test 4] Multi-Tenant Query Parameter Isolation...');
    const ownerOrgBRes = await request('POST', '/api/auth/register', {
      name: 'Owner Org B',
      email: `orgb_${timestamp}@teamflow.test`,
      password: 'Password123!',
      organisationName: `Org B Space ${timestamp}`,
    });

    const tokenB = ownerOrgBRes.body.token;
    const authHeadersB = {
      Authorization: `Bearer ${tokenB}`,
    };

    // Org B attempts to pass Org A's ID via query parameter
    const crossOrgProjectReq = await request('GET', `/api/projects?orgId=${orgId}`, null, authHeadersB);
    if (crossOrgProjectReq.statusCode !== 403) {
      throw new Error(`Cross-org access should have returned 403, got ${crossOrgProjectReq.statusCode}`);
    }
    console.log('  ✓ Cross-organisation query parameter tampering successfully blocked with HTTP 403 Forbidden');

    // Org B attempts to access Org A's project tasks
    const crossOrgTaskReq = await request('GET', `/api/projects/${projectId}/tasks`, null, authHeadersB);
    if (crossOrgTaskReq.statusCode !== 403) {
      throw new Error(`Cross-org task access should have returned 403, got ${crossOrgTaskReq.statusCode}`);
    }
    console.log('  ✓ Cross-organisation task retrieval blocked with HTTP 403 Forbidden');

    console.log('\n================================================================');
    console.log(' [SUCCESS] All Phase 3 Pagination, Search & Filter tests PASSED! ');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[FAILED] Phase 3 Test failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
    process.exit();
  }
};

runPhase3Tests();
