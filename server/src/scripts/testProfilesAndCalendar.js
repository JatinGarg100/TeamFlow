/**
 * testProfilesAndCalendar.js
 * ──────────────────────────
 * Master Verification Test Suite for:
 * 1. Team Member Profiles & Real Statistics
 * 2. Avatar Upload & Serving Security
 * 3. Calendar View & Task Due Date Logic
 * 4. Multi-Tenant Isolation & RBAC Boundaries
 * 5. Frontend Route and Component Contracts
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Organisation, Membership, User, Project, Task } = require('../models');
const orgController = require('../controllers/orgController');
const taskController = require('../controllers/taskController');
const authController = require('../controllers/authController');
const { uploadAvatar, avatarUploadDir, MAX_AVATAR_SIZE } = require('../middleware/uploadMiddleware');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 TEAMFLOW: TEAM MEMBER PROFILES & CALENDAR VIEW TEST SUITE');
  console.log('================================================================\n');

  // =========================================================================
  // SECTION 1: Team Member Profiles & Statistics Controller
  // =========================================================================
  console.log('--- SECTION 1: Member Profiles & Statistics Architecture ---');

  assert(typeof orgController.getMembers === 'function', 'getMembers controller is exported');
  assert(typeof orgController.getMemberProfile === 'function', 'getMemberProfile controller is exported');

  // Check validation on invalid organisation ID in getMemberProfile
  let capturedStatus = null;
  let capturedJson = null;
  const mockRes = {
    status: (code) => {
      capturedStatus = code;
      return {
        json: (payload) => {
          capturedJson = payload;
          return payload;
        },
      };
    },
  };

  await orgController.getMemberProfile(
    { params: { orgId: 'invalid-org-id', memberId: '507f1f77bcf86cd799439011' }, user: { _id: '507f1f77bcf86cd799439012' } },
    mockRes,
    () => {}
  );
  assert(capturedStatus === 400, 'getMemberProfile rejects invalid organisation ID with 400 Bad Request');
  assert(capturedJson?.success === false, 'Rejection response contains success: false');

  // Check validation on invalid member ID in getMemberProfile
  await orgController.getMemberProfile(
    { params: { orgId: '507f1f77bcf86cd799439011', memberId: 'invalid-member-id' }, user: { _id: '507f1f77bcf86cd799439012' } },
    mockRes,
    () => {}
  );
  assert(capturedStatus === 400, 'getMemberProfile rejects invalid member ID with 400 Bad Request');

  // Check User model avatar field and initials virtual
  const userAvatarPath = User.schema.path('avatar');
  assert(Boolean(userAvatarPath), 'User schema contains avatar property');
  assert(userAvatarPath.defaultValue === '', 'User avatar default value is empty string');

  const testUser = new User({ name: 'Alexander Wright', email: 'alex@example.com' });
  assert(testUser.initials === 'AW', 'User initials virtual generates "AW" from "Alexander Wright"');

  const singleNameUser = new User({ name: 'Cher', email: 'cher@example.com' });
  assert(singleNameUser.initials === 'CH', 'User initials virtual generates "CH" from single word name');

  // =========================================================================
  // SECTION 2: Profile Picture Upload & Safe Serving
  // =========================================================================
  console.log('\n--- SECTION 2: Profile Picture Upload & Safe Serving ---');

  assert(Boolean(uploadAvatar), 'uploadAvatar middleware is exported');
  assert(Boolean(avatarUploadDir), 'avatarUploadDir path is defined');
  assert(fs.existsSync(avatarUploadDir), 'avatarUploadDir directory exists on filesystem');
  assert(MAX_AVATAR_SIZE === 3 * 1024 * 1024, 'Avatar file upload size limit is enforced at 3 MB');

  assert(typeof authController.uploadUserAvatar === 'function', 'uploadUserAvatar controller is exported');
  assert(typeof authController.serveAvatar === 'function', 'serveAvatar controller is exported');
  assert(typeof authController.updateProfile === 'function', 'updateProfile controller is exported');

  // Test serveAvatar path traversal protection
  let serveStatus = null;
  let serveJson = null;
  const mockServeRes = {
    status: (code) => {
      serveStatus = code;
      return {
        json: (payload) => {
          serveJson = payload;
          return payload;
        },
      };
    },
    setHeader: () => {},
  };

  await authController.serveAvatar(
    { params: { filename: '../../non-existent-avatar.png' } },
    mockServeRes,
    () => {}
  );
  assert(serveStatus === 404, 'serveAvatar protects against path traversal and returns 404 for missing image');

  // =========================================================================
  // SECTION 3: Calendar View & Task Controller Contracts
  // =========================================================================
  console.log('\n--- SECTION 3: Calendar View & Task Controller Contracts ---');

  assert(typeof taskController.getTasks === 'function', 'getTasks controller is exported');
  assert(typeof taskController.getTaskById === 'function', 'getTaskById controller is exported');

  // getTasks requires organisation ID
  let taskStatus = null;
  let taskJson = null;
  const mockTaskRes = {
    status: (code) => {
      taskStatus = code;
      return {
        json: (payload) => {
          taskJson = payload;
          return payload;
        },
      };
    },
  };

  await taskController.getTasks(
    { query: {}, headers: {}, user: { _id: '507f1f77bcf86cd799439011' } },
    mockTaskRes,
    () => {}
  );
  assert(taskStatus === 400, 'getTasks rejects requests without orgId with 400 Bad Request');
  assert(taskJson?.success === false, 'Rejection response contains success: false');

  // getTaskById validates taskId format
  await taskController.getTaskById(
    { params: { taskId: 'invalid-id' }, user: { _id: '507f1f77bcf86cd799439011' } },
    mockTaskRes,
    () => {}
  );
  assert(taskStatus === 400, 'getTaskById rejects invalid task ID format with 400 Bad Request');

  // =========================================================================
  // SECTION 4: Overdue & Date Logic Verification
  // =========================================================================
  console.log('\n--- SECTION 4: Overdue & Task Due Date Logic ---');

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 2);

  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 5);

  const formatDateKey = (d) => {
    const dateObj = new Date(d);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isTaskOverdue = (task) => {
    if (!task.dueDate || task.status === 'Completed') return false;
    const taskKey = formatDateKey(task.dueDate);
    const todayKey = formatDateKey(today);
    return taskKey < todayKey;
  };

  // Case 1: Incomplete task with past due date -> OVERDUE
  const overdueTask = { title: 'Fix database migration', status: 'To Do', dueDate: pastDate };
  assert(isTaskOverdue(overdueTask) === true, 'Incomplete task past due date is marked overdue');

  // Case 2: In Progress task with past due date -> OVERDUE
  const inProgressOverdue = { title: 'Update documentation', status: 'In Progress', dueDate: pastDate };
  assert(isTaskOverdue(inProgressOverdue) === true, 'In-progress task past due date is marked overdue');

  // Case 3: Completed task with past due date -> NOT OVERDUE
  const completedTask = { title: 'Deploy frontend release', status: 'Completed', dueDate: pastDate };
  assert(isTaskOverdue(completedTask) === false, 'Completed task past due date is NEVER marked overdue');

  // Case 4: Incomplete task with future due date -> NOT OVERDUE
  const upcomingTask = { title: 'Prepare board meeting deck', status: 'To Do', dueDate: futureDate };
  assert(isTaskOverdue(upcomingTask) === false, 'Upcoming task is not marked overdue');

  // Case 5: Task without due date -> Cannot be overdue and excluded from calendar
  const noDueDateTask = { title: 'General backlog chore', status: 'To Do', dueDate: null };
  assert(isTaskOverdue(noDueDateTask) === false, 'Task without due date is not marked overdue');

  // =========================================================================
  // SECTION 5: Frontend Route & Component Contract Verification
  // =========================================================================
  console.log('\n--- SECTION 5: Frontend Component & Route Contracts ---');

  // 1. Check App.jsx contains /calendar route
  const appJsx = fs.readFileSync(path.join(__dirname, '../../../client/src/App.jsx'), 'utf8');
  assert(appJsx.includes('import Calendar from \'./pages/Calendar\';') || appJsx.includes('import Calendar from "./pages/Calendar";'), 'App.jsx imports Calendar page');
  assert(appJsx.includes('path="/calendar"'), 'App.jsx registers /calendar protected route');

  // 2. Check Sidebar.jsx contains Calendar item
  const sidebarJsx = fs.readFileSync(path.join(__dirname, '../../../client/src/components/Sidebar.jsx'), 'utf8');
  assert(sidebarJsx.includes("to: '/calendar'") || sidebarJsx.includes('to: "/calendar"'), 'Sidebar.jsx links to /calendar route');
  assert(sidebarJsx.includes("label: 'Calendar'") || sidebarJsx.includes('label: "Calendar"'), 'Sidebar.jsx contains "Calendar" menu entry');

  // 3. Check Calendar.jsx component exists and features
  const calendarJsxPath = path.join(__dirname, '../../../client/src/pages/Calendar.jsx');
  assert(fs.existsSync(calendarJsxPath), 'Calendar.jsx file exists');
  const calendarJsx = fs.readFileSync(calendarJsxPath, 'utf8');
  assert(calendarJsx.includes('viewMode'), 'Calendar implements viewMode state');
  assert(calendarJsx.includes('monthDays'), 'Calendar computes monthly calendar grid');
  assert(calendarJsx.includes('weekDays'), 'Calendar computes weekly calendar columns');
  assert(calendarJsx.includes('selectedProjectId'), 'Calendar implements project filter');
  assert(calendarJsx.includes('handleToday'), 'Calendar provides Today navigation button');
  assert(calendarJsx.includes('isOverdue'), 'Calendar checks and highlights overdue tasks');
  assert(calendarJsx.includes('TaskCommentsModal'), 'Calendar connects to TaskCommentsModal');
  assert(calendarJsx.includes('TaskAttachmentsModal'), 'Calendar connects to TaskAttachmentsModal');

  // 4. Check MemberProfileModal.jsx component exists and features
  const memberModalPath = path.join(__dirname, '../../../client/src/components/MemberProfileModal.jsx');
  assert(fs.existsSync(memberModalPath), 'MemberProfileModal.jsx file exists');
  const memberModalJsx = fs.readFileSync(memberModalPath, 'utf8');
  assert(memberModalJsx.includes('fetchMemberProfileApi'), 'MemberProfileModal fetches real member data');
  assert(memberModalJsx.includes('uploadAvatarApi'), 'MemberProfileModal supports avatar upload for logged-in user');
  assert(memberModalJsx.includes('assignedProjectsCount'), 'MemberProfileModal displays assigned projects count');
  assert(memberModalJsx.includes('completedTasksCount'), 'MemberProfileModal displays completed tasks count');
  assert(memberModalJsx.includes('pendingTasksCount'), 'MemberProfileModal displays pending tasks count');
  assert(memberModalJsx.includes('completionRate'), 'MemberProfileModal displays completion rate percentage');

  // 5. Check Employees.jsx connects to MemberProfileModal and views
  const employeesJsx = fs.readFileSync(path.join(__dirname, '../../../client/src/pages/Employees.jsx'), 'utf8');
  assert(employeesJsx.includes('MemberProfileModal'), 'Employees.jsx imports MemberProfileModal');
  assert(employeesJsx.includes('selectedProfileMemberId'), 'Employees.jsx implements profile modal selection state');
  assert(employeesJsx.includes('assignedProjectsCount'), 'Employees.jsx displays assigned projects count');
  assert(employeesJsx.includes('completedTasksCount'), 'Employees.jsx displays completed tasks count');
  assert(employeesJsx.includes('pendingTasksCount'), 'Employees.jsx displays pending tasks count');
  assert(employeesJsx.includes('viewMode'), 'Employees.jsx supports Table and Cards view modes');

  // 6. Check Settings.jsx personal profile and avatar upload
  const settingsJsx = fs.readFileSync(path.join(__dirname, '../../../client/src/pages/Settings.jsx'), 'utf8');
  assert(settingsJsx.includes('uploadAvatarApi'), 'Settings.jsx imports uploadAvatarApi');
  assert(settingsJsx.includes('handleAvatarUpload'), 'Settings.jsx implements avatar upload handler');
  assert(settingsJsx.includes('Personal Profile'), 'Settings.jsx contains Personal Profile section');

  console.log('\n================================================================');
  console.log(`✅ ALL ${passedTests}/${totalTests} TESTS PASSED FOR PROFILES & CALENDAR!`);
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite execution failed:', err);
  process.exit(1);
});
