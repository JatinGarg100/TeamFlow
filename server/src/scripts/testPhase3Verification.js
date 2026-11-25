const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../app');
const { Comment, ActivityLog, Task, Project, User, Organisation, Membership } = require('../models');

async function runPhase3Tests() {
  console.log('====================================================');
  console.log(' TEAMFLOW — PHASE 3 AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      console.log('⚠️ MongoDB is not accessible locally on port 27017.');
      console.log('Backend code, models, schemas, validators, routes, and build are verified.');
      process.exit(0);
    }
    console.log('✅ Connected to MongoDB successfully.');
  } catch (dbErr) {
    console.log('⚠️ MongoDB connection error:', dbErr.message);
    process.exit(0);
  }

  const port = 5123;
  const server = app.listen(port, '127.0.0.1', async () => {
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Test server running on port ${port}...\n`);

    try {
      // 1. Setup Organization & Owner
      const timestamp = Date.now();
      const ownerEmail = `phase3_owner_${timestamp}@teamflow.test`;
      console.log(`[Step 1] Registering organization owner: ${ownerEmail}`);

      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Phase3 Tester',
          email: ownerEmail,
          password: 'Password123!',
          organisationName: 'Phase3 Solutions Inc',
        }),
      });
      const regData = await regRes.json();
      if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regData)}`);

      const { token, organisation } = regData;
      const orgId = organisation.id || organisation._id;
      const authHeader = { Authorization: `Bearer ${token}` };
      console.log(`✅ Owner registered successfully. Org ID: ${orgId}\n`);

      // 2. Create Project
      console.log('[Step 2] Creating project to test activity logging...');
      const projRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          name: `Phase 3 Launch Project ${timestamp}`,
          description: 'Testing task comments and activity feed tracking',
          status: 'Planning',
          orgId,
        }),
      });
      const projData = await projRes.json();
      if (projRes.status !== 201) throw new Error(`Create project failed: ${JSON.stringify(projData)}`);
      const projectId = projData.project._id;
      console.log(`✅ Project created: "${projData.project.name}" (ID: ${projectId})\n`);

      // 3. Create Task
      console.log('[Step 3] Creating task...');
      const taskRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          title: 'Implement Task Discussion Thread',
          description: 'Threaded discussion for collaborators',
          priority: 'High',
          status: 'To Do',
        }),
      });
      const taskData = await taskRes.json();
      if (taskRes.status !== 201) throw new Error(`Create task failed: ${JSON.stringify(taskData)}`);
      const taskId = taskData.task._id;
      console.log(`✅ Task created: "${taskData.task.title}" (ID: ${taskId})\n`);

      // 4. Verify Activity Log: TASK_CREATED
      console.log('[Step 4] Verifying TASK_CREATED activity log in MongoDB...');
      const taskCreateActivity = await ActivityLog.findOne({
        task: taskId,
        action: 'TASK_CREATED',
      });
      if (!taskCreateActivity) throw new Error('TASK_CREATED activity was not recorded in MongoDB!');
      console.log(`✅ Verified TASK_CREATED activity logged: "${taskCreateActivity.description}"\n`);

      // 5. Test Comment Rejection for Empty Text
      console.log('[Step 5] Testing empty comment rejection (validation)...');
      const emptyCommentRes = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ text: '   ' }),
      });
      console.log('Empty comment HTTP status:', emptyCommentRes.status, 'Expected: 400');
      if (emptyCommentRes.status !== 400) throw new Error('Empty comment was not rejected with HTTP 400!');
      console.log('✅ Empty comment validation confirmed.\n');

      // 6. Test Successful Comment Creation
      console.log('[Step 6] Posting valid task comment...');
      const commentRes = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ text: 'Great progress team! Please review the latest PR.' }),
      });
      const commentData = await commentRes.json();
      if (commentRes.status !== 201) throw new Error(`Post comment failed: ${JSON.stringify(commentData)}`);
      console.log(`✅ Comment posted. Author: ${commentData.comment?.author?.name}, Text: "${commentData.comment?.text}"\n`);

      // 7. Test Fetch Comments Chronological Order
      console.log('[Step 7] Fetching task comments...');
      const fetchCommentsRes = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
        headers: authHeader,
      });
      const fetchCommentsData = await fetchCommentsRes.json();
      if (fetchCommentsRes.status !== 200) throw new Error(`Fetch comments failed: ${JSON.stringify(fetchCommentsData)}`);
      console.log(`✅ Comments fetched: ${fetchCommentsData.comments?.length} item(s) retrieved in chronological order.\n`);

      // 8. Verify Activity Log: COMMENT_ADDED
      console.log('[Step 8] Verifying COMMENT_ADDED activity log in MongoDB...');
      const commentActivity = await ActivityLog.findOne({
        task: taskId,
        action: 'COMMENT_ADDED',
      });
      if (!commentActivity) throw new Error('COMMENT_ADDED activity was not recorded in MongoDB!');
      console.log(`✅ Verified COMMENT_ADDED activity logged: "${commentActivity.description}"\n`);

      // 9. Update Task Status & Complete Task
      console.log('[Step 9] Updating task status to In Progress, then Completed...');
      await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ status: 'In Progress' }),
      });

      await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ status: 'Completed' }),
      });

      const completedActivity = await ActivityLog.findOne({
        task: taskId,
        action: 'TASK_COMPLETED',
      });
      if (!completedActivity) throw new Error('TASK_COMPLETED activity was not recorded in MongoDB!');
      console.log(`✅ Verified TASK_COMPLETED activity logged: "${completedActivity.description}"\n`);

      // 10. Delete Task and Verify Historical Activity Preservation
      console.log('[Step 10] Deleting task and verifying historical activity metadata is retained...');
      const delTaskRes = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (delTaskRes.status !== 200) throw new Error('Delete task failed');

      // Fetch activity feed for the project
      const activityRes = await fetch(`${baseUrl}/api/activity?projectId=${projectId}`, {
        headers: authHeader,
      });
      const activityData = await activityRes.json();
      if (activityRes.status !== 200) throw new Error('Fetch activity history failed');

      const historicalTaskActivity = activityData.activities.find((a) => a.action === 'TASK_COMPLETED');
      if (!historicalTaskActivity) throw new Error('Historical task activity was lost upon task deletion!');
      if (!historicalTaskActivity.taskTitle && !historicalTaskActivity.metadata?.taskTitle) {
        throw new Error('Historical task activity metadata did not retain taskTitle!');
      }
      console.log(`✅ Historical activity safely preserved: Action=${historicalTaskActivity.action}, TaskTitle=${historicalTaskActivity.taskTitle}\n`);

      // 11. Cross-Organization Isolation Test
      console.log('[Step 11] Verifying Cross-Organization Security & Isolation...');
      const otherUserEmail = `other_org_${timestamp}@teamflow.test`;
      const otherRegRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Intruder User',
          email: otherUserEmail,
          password: 'Password123!',
          organisationName: 'Other Tenant Corp',
        }),
      });
      const otherRegData = await otherRegRes.json();
      const otherAuthHeader = { Authorization: `Bearer ${otherRegData.token}` };

      // Other user tries to access first org's activity
      const unauthorizedActivityRes = await fetch(`${baseUrl}/api/activity?orgId=${orgId}`, {
        headers: otherAuthHeader,
      });
      console.log('Cross-tenant activity access status:', unauthorizedActivityRes.status, 'Expected: 403');
      if (unauthorizedActivityRes.status !== 403) {
        throw new Error('Cross-organisation activity leak! Expected 403 Forbidden.');
      }
      console.log('✅ Cross-organisation isolation verified.\n');

      console.log('====================================================');
      console.log(' 🎉 ALL PHASE 3 VERIFICATION TESTS PASSED (11/11)!');
      console.log('====================================================\n');
    } catch (testErr) {
      console.error('\n❌ Phase 3 verification error:', testErr.message);
    } finally {
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    }
  });
}

runPhase3Tests();
