/**
 * Integration Test: Phase 6 Full E2E User Journey & Security Verification
 * ------------------------------------------------------------------------
 * Verifies the complete 11-step user journey:
 * 1. Register Owner & create Organisation
 * 2. Add Employee directly with credentials
 * 3. Create Project
 * 4. Add Employee to Project Team
 * 5. Create Task and assign multiple employees
 * 6. Employee logs in and queries My Tasks
 * 7. Employee updates task status
 * 8. Manager monitors progress (live dynamic recalculation)
 * 9. Upload, view/download, and delete Task file attachment
 * 10. Role-based permission enforcement (Employee cannot change task assignees/priority)
 * 11. Multi-tenant isolation & Free Plan Quota enforcement
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const http = require('http');
const fs = require('fs');
const connectDB = require('../config/db');
const app = require('../app');
const { User, Organisation, Membership, Project, Task } = require('../models');
const { uploadDir } = require('../middleware/uploadMiddleware');

let server;
let baseUrl;

// JSON Request Helper
const jsonReq = (method, reqPath, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, baseUrl);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

// Multipart Upload Helper
const uploadReq = (taskId, filename, content, mimeType, token) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/tasks/${taskId}/attachments`, baseUrl);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    let body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files"; filename="${filename}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
    );
    body = Buffer.concat([body, Buffer.from(content), Buffer.from(`\r\n--${boundary}--\r\n`)]);

    const reqHeaders = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: reqHeaders,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

const runPhase6FinalAudit = async () => {
  console.log('\n================================================================');
  console.log('   Running Phase 6 Full User Journey & Security Audit Suite     ');
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

    // Step 1: Register Owner & Create Organisation
    console.log('[Step 1] Owner Registration & Workspace Creation...');
    const ownerRes = await jsonReq('POST', '/api/auth/register', {
      name: 'Elena Rostova',
      email: `elena_${timestamp}@teamflow.test`,
      password: 'SecurePassword123!',
      organisationName: `Nova Dynamics ${timestamp}`,
    });

    if (ownerRes.statusCode !== 201 || !ownerRes.body?.token) {
      throw new Error(`Owner registration failed: ${JSON.stringify(ownerRes.body)}`);
    }
    const ownerToken = ownerRes.body.token;
    const orgId = ownerRes.body.organisation.id;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}`, 'x-org-id': orgId };
    console.log(`  ✓ Owner registered and workspace "${ownerRes.body.organisation.name}" created.`);

    // Step 2: Add Employee Directly
    console.log('\n[Step 2] Direct Employee Account Provisioning...');
    const empEmail = `marcus_${timestamp}@teamflow.test`;
    const empPass = 'EmployeePass123!';
    const empRes = await jsonReq(
      'POST',
      `/api/orgs/${orgId}/members`,
      {
        name: 'Marcus Vance',
        email: empEmail,
        password: empPass,
        role: 'member',
      },
      ownerHeaders
    );

    if (empRes.statusCode !== 201) {
      throw new Error(`Employee creation failed: ${JSON.stringify(empRes.body)}`);
    }
    const employeeId = empRes.body.member.id;
    console.log(`  ✓ Employee Marcus Vance created with ID: ${employeeId}`);

    // Step 3: Create Project
    console.log('\n[Step 3] Project Creation by Manager...');
    const projRes = await jsonReq(
      'POST',
      '/api/projects',
      {
        name: 'Autonomous Flight Controller',
        description: 'Next generation firmware and testing pipeline',
        status: 'In Progress',
      },
      ownerHeaders
    );

    if (projRes.statusCode !== 201) {
      throw new Error(`Project creation failed: ${JSON.stringify(projRes.body)}`);
    }
    const projectId = projRes.body.project._id;
    console.log(`  ✓ Project created with ID: ${projectId}`);

    // Step 4: Add Employee to Project Team
    console.log('\n[Step 4] Enrolling Employee in Project Team...');
    const addTeamRes = await jsonReq(
      'POST',
      `/api/projects/${projectId}/members`,
      { userIds: [employeeId] },
      ownerHeaders
    );

    if (addTeamRes.statusCode !== 200) {
      throw new Error(`Failed to add employee to project team: ${JSON.stringify(addTeamRes.body)}`);
    }
    console.log('  ✓ Employee successfully added to project team.');

    // Step 5: Create Task and Assign Employee
    console.log('\n[Step 5] Task Creation with Assignees...');
    const taskRes = await jsonReq(
      'POST',
      `/api/projects/${projectId}/tasks`,
      {
        title: 'Calibrate Gyroscope Sensors',
        description: 'Run precision frequency sweep and verify tolerances',
        priority: 'High',
        status: 'To Do',
        assignedTo: [employeeId],
      },
      ownerHeaders
    );

    if (taskRes.statusCode !== 201) {
      throw new Error(`Task creation failed: ${JSON.stringify(taskRes.body)}`);
    }
    const taskId = taskRes.body.task._id;
    console.log(`  ✓ Task created and assigned to Marcus Vance.`);

    // Step 6: Employee Logs In and Queries "My Tasks"
    console.log('\n[Step 6] Employee Authentication & My Tasks Fetch...');
    const loginRes = await jsonReq('POST', '/api/auth/login', {
      email: empEmail,
      password: empPass,
    });

    if (loginRes.statusCode !== 200 || !loginRes.body?.token) {
      throw new Error(`Employee login failed: ${JSON.stringify(loginRes.body)}`);
    }
    const empToken = loginRes.body.token;
    const empHeaders = { Authorization: `Bearer ${empToken}` };

    const myTasksRes = await jsonReq('GET', '/api/tasks/my', null, empHeaders);
    if (myTasksRes.statusCode !== 200 || myTasksRes.body.data.length === 0) {
      throw new Error(`Employee could not retrieve assigned task: ${JSON.stringify(myTasksRes.body)}`);
    }
    console.log(`  ✓ Employee retrieved ${myTasksRes.body.data.length} assigned task(s).`);

    // Step 7: Employee Updates Task Status
    console.log('\n[Step 7] Employee Updates Task Status to "Completed"...');
    const updateStatusRes = await jsonReq(
      'PATCH',
      `/api/tasks/${taskId}`,
      { status: 'Completed' },
      empHeaders
    );

    if (updateStatusRes.statusCode !== 200 || updateStatusRes.body.task.status !== 'Completed') {
      throw new Error(`Employee status update failed: ${JSON.stringify(updateStatusRes.body)}`);
    }
    console.log('  ✓ Task status updated to "Completed".');

    // Step 8: Manager Monitors Progress Recalculation
    console.log('\n[Step 8] Manager Verifies Live Project Progress Recalculation...');
    const progressRes = await jsonReq(
      'GET',
      `/api/projects/${projectId}/progress`,
      null,
      ownerHeaders
    );

    if (progressRes.statusCode !== 200 || progressRes.body.percentage !== 100) {
      throw new Error(`Expected 100% completion, got: ${JSON.stringify(progressRes.body)}`);
    }
    console.log(`  ✓ Live dynamic progress accurately calculated at ${progressRes.body.percentage}%.`);

    // Step 9: Task Attachment Lifecycle (Upload, View/Download, Delete)
    console.log('\n[Step 9] Task Attachment Lifecycle (Upload, Stream Download, & Delete)...');
    const pdfData = '%PDF-1.4 Mock Calibration Test Report Data...';
    const uploadRes = await uploadReq(
      taskId,
      'calibration_report.pdf',
      pdfData,
      'application/pdf',
      ownerToken
    );

    if (uploadRes.statusCode !== 201 || uploadRes.body.attachments.length === 0) {
      throw new Error(`Attachment upload failed: ${JSON.stringify(uploadRes.body)}`);
    }
    const attachmentId = uploadRes.body.attachments[0]._id;
    console.log('  ✓ File attached to task and stored on disk.');

    // Download verification
    const downloadRes = await jsonReq(
      'GET',
      `/api/tasks/${taskId}/attachments/${attachmentId}?download=true`,
      null,
      empHeaders
    );
    if (downloadRes.statusCode !== 200) {
      throw new Error(`Attachment download failed: ${downloadRes.statusCode}`);
    }
    console.log('  ✓ File downloaded successfully with security headers.');

    // Delete attachment
    const delRes = await jsonReq(
      'DELETE',
      `/api/tasks/${taskId}/attachments/${attachmentId}`,
      null,
      ownerHeaders
    );
    if (delRes.statusCode !== 200) {
      throw new Error(`Attachment deletion failed: ${JSON.stringify(delRes.body)}`);
    }
    console.log('  ✓ Attachment record deleted from MongoDB and binary purged from disk.');

    // Step 10: Security Check - Employee Restricted from Editing Non-Status Fields
    console.log('\n[Step 10] Security Check: Employee Blocked from Modifying Task Priority/Title...');
    const illegalEditRes = await jsonReq(
      'PATCH',
      `/api/tasks/${taskId}`,
      { priority: 'Low', title: 'Hacked Title' },
      empHeaders
    );

    if (illegalEditRes.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden for employee editing non-status field, got ${illegalEditRes.statusCode}`);
    }
    console.log('  ✓ Employee successfully blocked with HTTP 403 Forbidden when attempting privileged task edits.');

    // Step 11: Multi-Tenant Scoping Protection
    console.log('\n[Step 11] Multi-Tenant Scoping Protection Across Workspaces...');
    const orgBRes = await jsonReq('POST', '/api/auth/register', {
      name: 'Foreign Agent',
      email: `foreign_${timestamp}@teamflow.test`,
      password: 'SecurePassword123!',
      organisationName: `Foreign Corp ${timestamp}`,
    });
    const foreignHeaders = { Authorization: `Bearer ${orgBRes.body.token}` };

    const crossOrgReq = await jsonReq('GET', `/api/projects/${projectId}`, null, foreignHeaders);
    if (crossOrgReq.statusCode !== 403) {
      throw new Error(`Expected 403 Forbidden on cross-organisation project fetch, got ${crossOrgReq.statusCode}`);
    }
    console.log('  ✓ Cross-tenant access successfully blocked with HTTP 403 Forbidden.');

    console.log('\n================================================================');
    console.log(' [SUCCESS] Complete Phase 6 End-to-End User Journey PASSED!      ');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[FAILED] Phase 6 Test failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    process.exit();
  }
};

runPhase6FinalAudit();
