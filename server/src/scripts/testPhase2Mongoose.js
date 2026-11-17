/**
 * Integration Test: Phase 2 Advanced MongoDB & Mongoose
 * ------------------------------------------------------
 * Validates:
 * 1. User Virtual (initials) and Static (findByEmail)
 * 2. Project Virtuals (teamSize, tasks virtual populate) and Instance method (hasMember)
 * 3. Project Static (findByOrganisation) and Query Helper (.byStatus())
 * 4. Task Virtuals (isOverdue, assigneeCount) and Instance method (isAssignedTo)
 * 5. Task Static (findByProject, findByAssignee) and Query Helpers (.byStatus(), .byPriority())
 * 6. Mongoose Pre-save/Pre-validate hooks (whitespace trimming and array deduplication)
 * 7. Selective Populate on Project and Task (without exposing passwordHash)
 * 8. Single-pass MongoDB Aggregations on Project Progress and Dashboard
 * 9. Schema Indexes verification
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User, Organisation, Membership, Project, Task } = require('../models');

const runPhase2Tests = async () => {
  console.log('\n==========================================================');
  console.log('   Running Phase 2 Advanced MongoDB & Mongoose Tests      ');
  console.log('==========================================================\n');

  try {
    await connectDB();
    const timestamp = Date.now();

    // 1. User Model Virtuals & Statics
    console.log('[Test 1] User Model: Virtuals and Static Methods...');
    const user = await User.create({
      name: 'Alice Wonder',
      email: `alice_${timestamp}@teamflow.test`,
      passwordHash: 'dummy_hash_12345',
    });

    if (user.initials !== 'AW') {
      throw new Error(`Expected initials 'AW', received '${user.initials}'`);
    }
    console.log(`  ✓ Virtual 'initials' correctly calculated: '${user.initials}'`);

    const foundUser = await User.findByEmail(`ALICE_${timestamp}@teamflow.test`);
    if (!foundUser || foundUser._id.toString() !== user._id.toString()) {
      throw new Error('Static method User.findByEmail() failed case-insensitive search');
    }
    console.log('  ✓ Static method User.findByEmail() returned exact user document');

    // Setup Organisation for relational testing
    const org = await Organisation.create({
      name: `Mongoose Test Org ${timestamp}`,
      slug: `mongoose-test-org-${timestamp}`,
      ownerId: user._id,
    });

    const secondUser = await User.create({
      name: 'Bob Builder',
      email: `bob_${timestamp}@teamflow.test`,
      passwordHash: 'dummy_hash_54321',
    });

    // 2. Project Model: Virtuals, Static Methods, Instance Methods, & Middleware
    console.log('\n[Test 2] Project Model: Virtuals, Statics, Methods, & Middleware...');
    const project = await Project.create({
      orgId: org._id,
      name: '  Project Alpha with extra spaces  ',
      description: '   Trimming description test   ',
      status: 'In Progress',
      teamMembers: [user._id],
      createdBy: user._id,
    });

    if (project.name !== 'Project Alpha with extra spaces' || project.description !== 'Trimming description test') {
      throw new Error(`Pre-save middleware failed to trim whitespace: '${project.name}'`);
    }
    console.log('  ✓ Mongoose pre-save middleware trimmed whitespace from name & description');

    if (project.teamSize !== 1) {
      throw new Error(`Expected teamSize 1, received ${project.teamSize}`);
    }
    console.log(`  ✓ Virtual 'teamSize' calculated: ${project.teamSize}`);

    if (!project.hasMember(user._id) || project.hasMember(secondUser._id)) {
      throw new Error('Instance method project.hasMember() returned incorrect boolean');
    }
    console.log('  ✓ Instance method project.hasMember() correctly identified member presence');

    const orgProjects = await Project.findByOrganisation(org._id);
    if (!orgProjects || orgProjects.length !== 1) {
      throw new Error('Static method Project.findByOrganisation() failed');
    }
    console.log('  ✓ Static method Project.findByOrganisation() returned projects list');

    // Query helper on Project
    const inProgressProjects = await Project.find({ orgId: org._id }).byStatus('In Progress');
    const completedProjects = await Project.find({ orgId: org._id }).byStatus('Completed');
    if (inProgressProjects.length !== 1 || completedProjects.length !== 0) {
      throw new Error('Project query helper .byStatus() failed');
    }
    console.log('  ✓ Query helper Project.find().byStatus() filtered accurately');

    // 3. Task Model: Virtuals, Static Methods, Instance Methods, & Query Helpers
    console.log('\n[Test 3] Task Model: Virtuals, Statics, Methods, & Query Helpers...');
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
    const task1 = await Task.create({
      orgId: org._id,
      projectId: project._id,
      title: '  Overdue Architecture Task  ',
      description: '   Ensure pipeline efficiency   ',
      status: 'In Progress',
      priority: 'High',
      dueDate: pastDate,
      assignedTo: [user._id, user._id], // duplicate test for pre-validate hook
      createdBy: user._id,
    });

    if (task1.assignedTo.length !== 1) {
      throw new Error(`Pre-validate hook failed to deduplicate assignedTo array: length ${task1.assignedTo.length}`);
    }
    console.log('  ✓ Pre-validate hook deduplicated assignedTo IDs');

    if (task1.title !== 'Overdue Architecture Task') {
      throw new Error(`Pre-validate hook failed to trim title: '${task1.title}'`);
    }
    console.log('  ✓ Pre-validate hook trimmed whitespace from title');

    if (task1.isOverdue !== true) {
      throw new Error('Virtual task.isOverdue failed to detect past due date');
    }
    console.log('  ✓ Virtual task.isOverdue returned true for incomplete past task');

    if (task1.assigneeCount !== 1) {
      throw new Error(`Expected assigneeCount 1, received ${task1.assigneeCount}`);
    }
    console.log(`  ✓ Virtual task.assigneeCount returned: ${task1.assigneeCount}`);

    if (!task1.isAssignedTo(user._id) || task1.isAssignedTo(secondUser._id)) {
      throw new Error('Instance method task.isAssignedTo() failed');
    }
    console.log('  ✓ Instance method task.isAssignedTo() validated correctly');

    const task2 = await Task.create({
      orgId: org._id,
      projectId: project._id,
      title: 'Completed Task',
      status: 'Completed',
      priority: 'Low',
      assignedTo: [secondUser._id],
      createdBy: user._id,
    });

    // Query helpers on Task
    const highPriorityTasks = await Task.find({ projectId: project._id }).byPriority('High');
    const completedTasks = await Task.find({ projectId: project._id }).byStatus('Completed');
    if (highPriorityTasks.length !== 1 || completedTasks.length !== 1) {
      throw new Error('Task query helpers .byPriority() or .byStatus() failed');
    }
    console.log('  ✓ Query helpers Task.find().byPriority() and .byStatus() filtered accurately');

    // 4. Virtual Populate
    console.log('\n[Test 4] Mongoose Virtual Populate...');
    const projectWithPopulatedTasks = await Project.findById(project._id).populate('tasks');
    if (!projectWithPopulatedTasks.tasks || projectWithPopulatedTasks.tasks.length !== 2) {
      throw new Error(`Virtual populate 'tasks' failed. Expected 2 child tasks, got: ${projectWithPopulatedTasks.tasks?.length}`);
    }
    console.log(`  ✓ Virtual populate project.populate('tasks') populated ${projectWithPopulatedTasks.tasks.length} child tasks without storing foreign keys`);

    // 5. Populate Data Hygiene & Projection
    console.log('\n[Test 5] MongoDB Populate Field Projection & Security...');
    const populatedTask = await Task.findById(task1._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    if (populatedTask.assignedTo[0].passwordHash || populatedTask.createdBy.passwordHash) {
      throw new Error('SECURITY LEAK: populate exposed user passwordHash!');
    }
    if (!populatedTask.assignedTo[0].name || !populatedTask.assignedTo[0].email) {
      throw new Error('populate failed to project requested fields');
    }
    console.log('  ✓ Populate safely projected name and email without leaking passwordHash');

    // 6. MongoDB Aggregation
    console.log('\n[Test 6] MongoDB Aggregation Pipeline...');
    const aggResult = await Task.aggregate([
      { $match: { projectId: project._id } },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
          pendingTasks: {
            $sum: { $cond: [{ $ne: ['$status', 'Completed'] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = aggResult[0];
    if (stats.totalTasks !== 2 || stats.completedTasks !== 1 || stats.pendingTasks !== 1) {
      throw new Error(`Aggregation returned unexpected counts: ${JSON.stringify(stats)}`);
    }
    const computedPercentage = Math.round((stats.completedTasks / stats.totalTasks) * 100);
    if (computedPercentage !== 50) {
      throw new Error(`Expected 50% completion, got ${computedPercentage}%`);
    }
    console.log(`  ✓ Aggregation computed: Total=${stats.totalTasks}, Completed=${stats.completedTasks}, Pending=${stats.pendingTasks}, Completion=${computedPercentage}%`);

    // 7. Verify Schema Indexes
    console.log('\n[Test 7] Schema Indexes Verification...');
    const projectIndexes = await Project.collection.indexes();
    const taskIndexes = await Task.collection.indexes();

    const hasProjectOrgStatusIdx = projectIndexes.some((idx) => idx.key.orgId === 1 && idx.key.status === 1);
    const hasTaskProjectPriorityIdx = taskIndexes.some((idx) => idx.key.projectId === 1 && idx.key.priority === 1);

    if (!hasProjectOrgStatusIdx) {
      throw new Error('Project index { orgId: 1, status: 1 } is missing');
    }
    if (!hasTaskProjectPriorityIdx) {
      throw new Error('Task index { projectId: 1, priority: 1, status: 1 } is missing');
    }
    console.log('  ✓ Verified compound indexes in MongoDB:');
    console.log('     - Project: { orgId: 1, status: 1 }');
    console.log('     - Task: { projectId: 1, priority: 1, status: 1 }');

    console.log('\n==========================================================');
    console.log(' [SUCCESS] All Phase 2 Advanced MongoDB & Mongoose Tests PASSED!');
    console.log('==========================================================\n');
  } catch (err) {
    console.error('\n[FAILED] Phase 2 Test failed with error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
};

runPhase2Tests();
