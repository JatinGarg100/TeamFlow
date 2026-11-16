/**
 * Subscription Plans Configuration
 * ---------------------------------
 * Defines standard SaaS tiers, pricing, and feature quotas for TeamFlow.
 */
const plansConfig = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    period: 'forever',
    description: 'Essential project and task management for small teams starting out.',
    features: [
      'Up to 5 team members',
      'Up to 3 active projects',
      'Standard task backlog and status tracking',
      'Basic milestone progress calculation',
      'Community & email support',
    ],
    limitations: [
      'No priority support',
      'No custom roles or granular permissions',
      'No automated billing or usage metering',
    ],
    recommended: false,
    limits: {
      maxMembers: 5,
      maxProjects: 3,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    priceLabel: '$29',
    period: 'month',
    description: 'Full-featured collaboration platform for growing companies and engineering teams.',
    features: [
      'Unlimited team members',
      'Unlimited active projects',
      'Advanced task assignment & live progress metrics',
      'Role-based permissions (Owner, Admin, Manager, Member)',
      'Priority 24/7 technical support',
      'Complete milestone analytics',
    ],
    limitations: [],
    recommended: true,
    limits: {
      maxMembers: Infinity,
      maxProjects: Infinity,
    },
  },
];

module.exports = plansConfig;
