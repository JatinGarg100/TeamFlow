const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from .env
dotenv.config();

const {
  User,
  Organisation,
  Membership,
  Project,
  Task,
  Subscription,
  UsageRecord,
} = require('../models');

const connectDB = require('../config/db');

/**
 * Seed Script
 * -----------
 * Populates initial sample data into the teamflow database
 * so it appears immediately in MongoDB Compass.
 */
const seedDatabase = async () => {
  console.log('[Seed] Connecting to MongoDB...');
  await connectDB();

  try {
    console.log('[Seed] Clearing previous data in teamflow (if any)...');
    await Promise.all([
      User.deleteMany({}),
      Organisation.deleteMany({}),
      Membership.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      Subscription.deleteMany({}),
      UsageRecord.deleteMany({}),
    ]);

    console.log('[Seed] Inserting initial data...');

    // 1. Create Admin User
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@teamflow.io',
      passwordHash: '$2b$10$demoHashedPasswordPlaceholder', // placeholder hash
    });

    const devUser = await User.create({
      name: 'Aarav Sharma',
      email: 'aarav@teamflow.io',
      passwordHash: '$2b$10$demoHashedPasswordPlaceholder',
    });

    // 2. Create Organisation
    const org = await Organisation.create({
      name: 'Acme Corporation',
      slug: 'acme-corp',
      ownerId: adminUser._id,
      plan: 'pro',
    });

    // 3. Create Memberships
    await Membership.create([
      { orgId: org._id, userId: adminUser._id, role: 'owner' },
      { orgId: org._id, userId: devUser._id, role: 'member' },
    ]);

    // 4. Create Project
    const project = await Project.create({
      orgId: org._id,
      name: 'E-Commerce Platform',
      description: 'Full-stack online storefront with payment integration.',
      deadline: new Date('2026-12-15'),
      status: 'In Progress',
      createdBy: adminUser._id,
      teamMembers: [adminUser._id, devUser._id],
      createdBy: adminUser._id,
    });

    // 5. Create Task
    await Task.create({
      orgId: org._id,
      projectId: project._id,
      title: 'Design Checkout Flow',
      description: 'Create responsive checkout interface using Tailwind CSS.',
      assignedTo: devUser._id,
      priority: 'High',
      dueDate: new Date('2026-11-20'),
      status: 'In Progress',
      createdBy: adminUser._id,
    });

    // 6. Create Subscription
    await Subscription.create({
      orgId: org._id,
      plan: 'pro',
      status: 'active',
    });

    // 7. Create UsageRecord
    await UsageRecord.create({
      orgId: org._id,
      metric: 'projects_count',
      quantity: 1,
      periodStart: new Date(),
    });

    console.log('----------------------------------------------------');
    console.log('✅ Success: Sample data inserted into "teamflow" database!');
    console.log('👉 Go to MongoDB Compass and click the Refresh button (🔄)');
    console.log('   The "teamflow" database will now be visible.');
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('[Seed] Error seeding data:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seedDatabase();
