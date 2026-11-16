# TeamFlow — Company, Project and Task Management SaaS

> A modern, multi-tenant Full-Stack MERN (MongoDB, Express, React, Node.js) Software-as-a-Service (SaaS) platform built for project coordination, multi-assignee task workflows, employee invitations, dynamic progress tracking, and email notifications.

---

## 📑 Table of Contents
1. [Project Overview & Key Features](#-project-overview--key-features)
2. [Technology Stack](#-technology-stack)
3. [Architecture & Data Flow](#-architecture--data-flow)
4. [Folder Structure](#-folder-structure)
5. [Prerequisites](#-prerequisites)
6. [Installation & Setup](#-installation--setup)
7. [Environment Variables](#-environment-variables)
8. [Running the Application](#-running-the-application)
9. [Main API Endpoints](#-main-api-endpoints)
10. [Automated Testing](#-automated-testing)
11. [Git & GitHub Preparation](#-git--github-preparation)
12. [Five-Minute Evaluation Demonstration Guide](#-five-minute-evaluation-demonstration-guide)
13. [Known Limitations & Future Roadmap](#-known-limitations--future-roadmap)

---

## 🌟 Project Overview & Key Features

TeamFlow solves company collaboration challenges by providing isolated workspace tenants, automated progress calculation, clean role-based project coordination, and reliable notification pipelines:

- **Multi-Tenant Workspace Isolation:** Every user belongs to an organisation with isolated data. Cross-tenant access is strictly denied with HTTP 403 Forbidden checks.
- **Two Distinct Registration Journeys:**
  - **Company Owner Registration (`/register`):** Creates a new organisation tenant and assigns the `owner` role.
  - **Employee Invitation Flow (`/invite/:token`):** Owners/Managers generate cryptographically secure invitations. Employees set up their password and join the workspace directly without creating duplicate accounts.
- **Project Team Management:**
  - Projects support multiple team members (`teamMembers: [ObjectId]`).
  - Managers can add or remove members from projects.
  - **Active Task Safety Check:** The backend blocks removing a member from a project if they still have open/in-progress tasks assigned to them.
- **Multi-Assignee Tasks & Shared Status:**
  - Tasks support multiple assignees (`assignedTo: [ObjectId]`).
  - **Shared Status:** Any assigned employee can update the task milestone (`To Do` ➔ `In Progress` ➔ `Completed`), synchronizing across all assignees and immediately recalculating live project progress.
  - **Permission Enforcement:** Normal employees can only update task status; arbitrary field changes (title, description, priority, assignees) are rejected with HTTP 403.
- **Dedicated "My Tasks" Dashboard (`/my-tasks`):**
  - Personal task view for employees displaying all tasks assigned to them across all projects, with priority badges, status filters, and instant status toggling.
- **Email Notifications via Nodemailer:**
  - Sends formatted HTML emails upon task assignment and workspace invitation.
  - Automatic deduplication prevents duplicate emails.
  - Includes a non-blocking development console fallback when SMTP is unconfigured.
- **Zero Decorative Images:**
  - Clean, high-performance UI styled with initials-based avatars, SVG icons, and a cohesive purple theme (`#5B4BDB`).
- **Subscription Tier Visibility & Plan Quotas:**
  - Free plan enforces strict quotas (5 members maximum, 3 active projects maximum).

---

## 💻 Technology Stack

### Frontend (`client/`)
- **Library:** React 19 (Functional Components, Hooks: `useState`, `useEffect`, `useCallback`)
- **Build Tool:** Vite 6
- **Routing:** React Router v7 (`react-router-dom`)
- **Styling:** Tailwind CSS v4 & responsive CSS utility system
- **API Communication:** Native Fetch API configured with credentials (`include`) and Bearer token fallbacks

### Backend (`server/`)
- **Runtime:** Node.js (CommonJS standard)
- **Framework:** Express 4
- **Database:** MongoDB via Mongoose 8
- **Authentication:** `jsonwebtoken` (JWT) & `bcryptjs`
- **Email Delivery:** `nodemailer` with SMTP and development console logging fallback
- **Security & Utilities:** `cookie-parser`, `cors`, `dotenv`, `crypto`

---

## 🏛️ Architecture & Data Flow

TeamFlow follows a clean 3-tier architectural model:

```
┌────────────────────────────────────────────────────────┐
│             React Client (Port 5173)                   │
│   Components ──► Pages ──► api.js Fetch Service        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON (CORS + Cookies)
                           ▼
┌────────────────────────────────────────────────────────┐
│             Express API Server (Port 5000)             │
│   Router ──► Auth/Org Middleware ──► Controller        │
└──────────────────────────┬─────────────────────────────┘
                           │ Mongoose ODM
                           ▼
┌────────────────────────────────────────────────────────┐
│             MongoDB Database (Port 27017)              │
│   Collections: users, organisations, memberships,      │
│                projects, tasks, invitations            │
└────────────────────────────────────────────────────────┘
```

### Complete Request-Response Flow
1. **User Action:** An employee updates task status on the "My Tasks" or "Project Details" page.
2. **API Call:** React invokes `updateTaskStatusApi(taskId, 'Completed')` in [`client/src/services/api.js`](file:///c:/Users/ASUS/Downloads/TeamFlow/client/src/services/api.js).
3. **Middleware Verification:** Express passes the request through `requireAuth` to verify the JWT token and `requireOrgMember` to ensure tenant authorization.
4. **Controller & Database Update:** `taskController.updateTask` updates the shared task document in MongoDB.
5. **State Synchronization:** The React frontend receives the updated task and immediately triggers a progress re-calculation from `GET /api/projects/:id/progress`, updating the UI without a full page reload.

---

## 📂 Folder Structure

```text
TeamFlow/
├── .gitignore                           # Root Git ignore rules (node_modules, .env, dist)
├── README.md                            # Comprehensive project manual
│
├── client/                              # Frontend React Application
│   ├── index.html                       # HTML5 entry point
│   ├── package.json                     # Vite & React dependencies
│   ├── vite.config.js                   # Vite configuration
│   ├── src/
│   │   ├── main.jsx                     # React DOM root mounting
│   │   ├── App.jsx                      # Route definitions
│   │   ├── index.css                    # Tailwind CSS v4 directives & color variables
│   │   ├── components/                  # Shared UI components (Navbar, Sidebar, Layout)
│   │   ├── pages/                       # Application Views
│   │   │   ├── Dashboard.jsx            # Dynamic MongoDB metrics dashboard
│   │   │   ├── Projects.jsx             # Project cards & multi-member creation modal
│   │   │   ├── ProjectDetails.jsx       # Tasks table, team manager, progress bar
│   │   │   ├── MyTasks.jsx              # Personal assigned tasks board
│   │   │   ├── Employees.jsx            # Invitation management & employee directory
│   │   │   ├── AcceptInvite.jsx         # Employee token invitation acceptance page
│   │   │   ├── Plans.jsx                # Subscription plans & quota indicators
│   │   │   ├── Login.jsx                # Secure login screen
│   │   │   └── Register.jsx             # Organisation owner registration
│   │   └── services/
│   │       └── api.js                   # Centralized Fetch API helpers
│
└── server/                              # Backend Express & MongoDB API
    ├── package.json                     # Node.js dependencies (Nodemailer, JWT, Mongoose)
    ├── .env.example                     # Environment template with SMTP settings
    └── src/
        ├── app.js                       # Express app configuration & middleware pipeline
        ├── server.js                    # HTTP listener & database connection
        ├── config/
        │   ├── db.js                    # Mongoose connection logic
        │   └── plans.js                 # Free & Pro tier configurations
        ├── models/
        │   ├── User.js                  # User schema with bcrypt hashing
        │   ├── Organisation.js          # Tenant schema with slug and plan
        │   ├── Membership.js            # User-to-Organisation role junction
        │   ├── Project.js               # Projects with teamMembers: [ObjectId]
        │   ├── Task.js                  # Tasks with assignedTo: [ObjectId]
        │   └── Invitation.js            # Workspace invitation tokens (SHA-256 hashed)
        ├── middlewares/
        │   ├── auth.js                  # requireAuth JWT verification
        │   ├── orgMember.js             # Tenant isolation & membership validation
        │   └── errorHandler.js          # Centralized error handler
        ├── controllers/
        │   ├── authController.js        # Register, Login, Me, Logout
        │   ├── orgController.js         # Employee list & management
        │   ├── projectController.js     # Project CRUD, Add/Remove team members
        │   ├── taskController.js        # Multi-assignee task CRUD, My Tasks, Progress
        │   ├── invitationController.js  # Create, Verify, and Accept invitations
        │   └── dashboardController.js   # Live MongoDB aggregation metrics
        ├── routes/
        │   ├── authRoutes.js
        │   ├── orgRoutes.js
        │   ├── projectRoutes.js
        │   ├── taskRoutes.js
        │   ├── invitationRoutes.js
        │   └── dashboardRoutes.js
        ├── services/
        │   └── mailer.js                # Nodemailer service with dev fallback
        └── scripts/
            ├── testNewRequirements.js   # 15-test automated verification suite
            ├── testPlanLimits.js        # 5-member and 3-project plan quota tests
            └── seed.js                  # Demo data seeder
```

---

## ⚙️ Prerequisites

- **Node.js:** v18.x or higher
- **npm:** v9.x or higher
- **MongoDB:** MongoDB Community Server (v6.0+) running locally on port 27017, or a MongoDB Atlas connection string.

---

## 📥 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/TeamFlow.git
cd TeamFlow
```

### 2. Install Backend Dependencies
```bash
cd server
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../client
npm install
```

---

## 🔐 Environment Variables

In the `server/` folder, create a `.env` file by copying `.env.example`:

```bash
cd server
cp .env.example .env
```

### Server `.env` Configuration
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/teamflow
CLIENT_URL=http://localhost:5173
JWT_SECRET=teamflow_super_secret_jwt_key_change_in_production_123456
JWT_EXPIRES_IN=7d

# SMTP Email Configuration (Optional - falls back to console in development)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=TeamFlow <notifications@teamflow.io>
```

> [!NOTE]
> If SMTP variables are omitted, email notifications are safely logged to the development console with full formatting, allowing complete offline testing.

---

## 🚀 Running the Application

### 1. Start the Backend API Server
```bash
cd server
npm run dev
```
- Server starts on: `http://localhost:5000`
- API Health Check: `http://localhost:5000/healthz`

### 2. Start the Frontend React Client
```bash
cd client
npm run dev
```
- Client runs on: `http://localhost:5173`

---

## 📡 Main API Endpoints

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Registers a company owner and creates an organisation workspace. |
| `POST` | `/api/auth/login` | Public | Validates credentials and returns JWT token & user session. |
| `GET` | `/api/auth/me` | Protected | Returns authenticated user profile and memberships. |
| `POST` | `/api/auth/logout` | Protected | Clears authentication cookies and session. |

### 2. Organisation Employees & Invitations (`/api/orgs` & `/api/invitations`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/orgs/:orgId/members` | Protected (Member) | Retrieves all members belonging to the specified organisation. |
| `POST` | `/api/orgs/:orgId/members` | Protected (Owner/Admin) | Directly provisions an employee account with Name, Email, Password, and Role. |
| `DELETE` | `/api/orgs/:orgId/members/:memberId` | Protected (Owner/Admin) | Removes an employee from the organisation. Blocked if active open tasks exist. |
| `POST` | `/api/orgs/:orgId/invitations` | Protected (Manager+) | Generates an invitation token and dispatches email notification. |
| `GET` | `/api/orgs/:orgId/invitations` | Protected (Manager+) | Lists active pending invitations. |
| `DELETE` | `/api/orgs/:orgId/invitations/:invitationId` | Protected (Owner/Admin) | Cancels / revokes a pending invitation. |
| `GET` | `/api/invitations/:token` | Public | Validates invitation token validity and expiration. |
| `POST` | `/api/invitations/:token/accept` | Public | Accepts invitation, sets user password, and links to organisation. |

### 3. Project Management (`/api/projects`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/projects` | Protected (Member) | Lists organisation projects. |
| `POST` | `/api/projects` | Protected (Manager+) | Creates a project with multiple team members. |
| `GET` | `/api/projects/:projectId` | Protected (Org Member) | Fetches project details. |
| `PATCH` | `/api/projects/:projectId` | Protected (Manager+) | Updates status, milestone details, or team. |
| `POST` | `/api/projects/:projectId/members` | Protected (Manager+) | Adds members to an existing project team. |
| `DELETE` | `/api/projects/:projectId/members/:userId` | Protected (Manager+) | Removes member. Blocked if member has active tasks. |

### 4. Tasks & Progress (`/api/tasks` & `/api/projects/:id/tasks`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/tasks/my` | Protected (Employee) | Retrieves all tasks assigned to the authenticated user. |
| `GET` | `/api/projects/:id/tasks` | Protected (Org Member) | Lists tasks with multiple assignees. |
| `POST` | `/api/projects/:id/tasks` | Protected (Manager+) | Creates task with multiple assignees; sends email notifications. |
| `PATCH` | `/api/tasks/:taskId` | Protected (Assignee/Manager) | Updates status (employees) or full details (managers). |
| `GET` | `/api/projects/:id/progress` | Protected (Org Member) | Calculates live dynamic progress percentage. |

---

## 🧪 Automated Testing

TeamFlow includes automated integration test suites:

```bash
cd server
# Run comprehensive requirements test suite (15/15)
npm run test:requirements

# Run employee add & remove lifecycle test suite
npm run test:employees
```

### Verified Test Assertions:
1. Owner registration
2. Invitation token generation
3. Invitation acceptance (creates Employee user, adds to Organisation)
4. Expired token rejection
5. Already-accepted token rejection
6. Project creation with multiple members
7. Add member to project
8. Member removal blocked when member has active assigned tasks
9. Member removal allowed after active tasks are completed or reassigned
10. Task creation with multiple assignees
11. My Tasks endpoint returns tasks where user is in assignedTo array
12. Employee cannot edit arbitrary task fields, only status
13. Task status update by one assignee reflects for all assignees and recalculates project progress correctly
14. Task assignment email is sent without duplicate recipients
15. Multi-tenant isolation: User from Org A cannot access Project/Task from Org B

---

## 📦 Git & GitHub Preparation

### Security & Secret Exclusion
The root `.gitignore` and `server/.gitignore` exclude all sensitive files:
- `node_modules/`
- `.env` and `.env.local`
- `client/dist/`
- npm logs and OS cache files

---

## 🎯 Five-Minute Evaluation Demonstration Guide

1. **Owner Registration:** Go to `http://localhost:5173/register` and create an organisation workspace.
2. **Invite an Employee:** Go to **Employees**, click **+ Invite Employee**, enter an email and generate the invite link.
3. **Accept Invite:** Open the generated invite link in an incognito window, set the employee name and password, and enter the workspace.
4. **Create a Multi-Member Project:** As the owner, create a project and assign both yourself and the employee.
5. **Assign Multi-Assignee Task:** Inside the project, create a task and assign both team members. Note the formatted notification email in the server console.
6. **Update Task & Watch Live Progress:** Log in as the employee, open **My Tasks**, change the task status to **Completed**, and watch the project's progress bar update to 100%!
