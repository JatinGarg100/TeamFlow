# TeamFlow — Company, Project & Task Management SaaS

TeamFlow is a full-stack B2B multi-tenant SaaS application built on the MERN stack (MongoDB, Express.js, React, Node.js). It provides project tracking, multi-assignee task coordination, live aggregation-driven dashboard analytics, task file attachments, role-based access control (RBAC), and subscription quota management.

---

## 🚀 Quick Start Guide

### Option 1: Running with Docker Compose (Recommended)

Docker Compose provisions and connects three isolated services: **MongoDB**, the **Express API Backend**, and the **React/Vite Frontend** (served via Nginx).

#### Prerequisites:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Engine and Docker Compose)

#### Step 1: Prepare Environment Configuration
Copy the root `.env.example` file to create your local `.env`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

#### Step 2: Build & Start All Containers
```bash
docker compose up -d --build
```

#### Step 3: Access the Application
* **Frontend Web App:** [http://localhost:5173](http://localhost:5173)
* **Backend Health Check:** [http://localhost:5000/healthz](http://localhost:5000/healthz)
* **API Welcome Endpoint:** [http://localhost:5000/](http://localhost:5000/)

#### Stopping and Managing Containers
```bash
# View live logs across all services
docker compose logs -f

# Check container health status
docker compose ps

# Stop containers gracefully (preserves database and uploads)
docker compose down

# Stop and wipe persistent volumes (WARNING: resets database and uploads)
docker compose down -v
```

---

### Option 2: Running Locally Without Docker

#### Prerequisites:
* **Node.js**: v18 LTS or higher (v20+ recommended)
* **MongoDB**: A local instance running on `localhost:27017` or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI

#### 1. Setup Backend:
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
*The server will run on `http://localhost:5000`.*

#### 2. Setup Frontend:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
*The React application will open on `http://localhost:5173`.*

---

## 💾 Persistent Storage & Backup Architecture

### 1. MongoDB Database Data (`mongo_data` volume)
In Docker Compose, MongoDB persists its documents into a dedicated Docker volume (`mongo_data`). Even if containers are stopped, removed, or updated, your workspaces, users, projects, and task records remain intact.

* **Backup Command:**
  ```bash
  docker compose exec mongodb mongodump --out=/data/db/backup
  ```

### 2. Task File Attachments (`task_attachments` volume)
Uploaded task documents and images are stored outside MongoDB in `server/uploads/task-attachments/`. In Docker, this folder is bound to the `task_attachments` volume.

* **Backup Command:**
  ```bash
  docker compose cp backend:/app/uploads/task-attachments ./backup-attachments
  ```

---

## 🔒 Security & Environment Architecture

TeamFlow follows strict 12-factor application security:
* **No Secret Commits:** Real `.env` files, credentials, and uploaded files are excluded from Git via `.gitignore`.
* **Zero Hardcoded Fallbacks in Production:** Production execution immediately aborts if `JWT_SECRET` is missing or uses development placeholders.
* **Non-Root Execution:** The backend container runs under the unprivileged `node` user.
* **Internal Network Isolation:** MongoDB is not exposed to the public Internet; it only communicates over the private Docker bridge network (`teamflow-network`).

---

## 🧪 Running Automated Tests

All phases are covered by automated integration test suites:

```bash
# 1. Phase 1: Security, express-validator schemas, and error handling
node server/src/scripts/testPhase1Quality.js

# 2. Phase 2: Mongoose virtuals, statics, instance methods, and aggregations
node server/src/scripts/testPhase2Mongoose.js

# 3. Phase 3: Server pagination, debounced search, and multi-field filtering
node server/src/scripts/testPhase3Pagination.js

# 4. Phase 4: Multer task attachments, streaming downloads, and disk purge
node server/src/scripts/testPhase4Attachments.js

# 5. Core Requirements & Multi-Tenant Regression Suite (15/15 tests)
npm --prefix server run test:requirements

# 6. Direct Employee Management & Dashboard Sync (8/8 tests)
npm --prefix server run test:employees

# 7. Subscription Plan Quota Enforcement (Free tier 5 members & 3 projects)
npm --prefix server run test:limits
```

---

## 🛠️ GitHub Actions CI/CD Pipeline

The automated CI workflow is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
1. **`backend-test` job:** Spawns an official `mongo:7.0` container, installs dependencies with `npm ci`, and runs all Phase 1–4 integration test suites and regression tests.
2. **`frontend-build` job:** Installs frontend dependencies and runs `npm run build` to verify production Vite bundle compilation without syntax or asset errors.

---

## ⚙️ Troubleshooting Common Issues

* **Port Already in Use (5000 or 5173):**
  Change `SERVER_PORT` or `CLIENT_PORT` in your root `.env` file (e.g. `SERVER_PORT=5001`, `CLIENT_PORT=5174`).
* **MongoDB Connection Refused (Local Dev):**
  Ensure MongoDB service is running locally (`net start MongoDB` on Windows) or supply a valid cloud connection string in `server/.env`.
* **Nginx SPA 404 on Refresh (Docker):**
  The provided `client/nginx.conf` includes `try_files $uri $uri/ /index.html;`, routing all HTML5 History API refreshes to React Router.
