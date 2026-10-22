# SmartWeld Monitor

A college-project prototype for real-time robotic welding operations, quality metrics, downtime, OEE, alerts, and maintenance workflows.

> **Prototype limitation:** This version uses simulated sensor data. Physical robotic welding machine integration is not included.

## Run locally

1. Install Node.js 18+.
2. Run `npm install` in the root and `npm install` in `client`.
3. Copy `.env.example` to `.env`.
4. Start MongoDB: `docker compose up -d`.
5. Start both apps with `npm run dev`.
6. Open `http://localhost:5173`.

The Express API connects to MongoDB at `MONGODB_URI` and creates the demo users, machines, alerts, and maintenance records on first startup. Demo passwords are stored as bcrypt hashes. Simulator readings and alert status changes are persisted to MongoDB.

## Demo accounts

- Admin: `admin@smartweld.com` / `Admin@123`
- Manager: `manager@smartweld.com` / `Manager@123`
- Supervisor: `supervisor@smartweld.com` / `Supervisor@123`
- Operator: `operator@smartweld.com` / `Operator@123`
- Maintenance: `maintenance@smartweld.com` / `Maintenance@123`

## Architecture

React/Vite renders role-aware dashboards and consumes the Express REST API. Socket.IO pushes simulator snapshots every five seconds. The Node.js/Express server uses Mongoose models to persist users, machines, alerts, and maintenance records in MongoDB, and owns OEE/quality calculations and the rule-based health score surface.

## Core logic

OEE = Availability x Performance x Quality. Quality is calculated as good units divided by total units. Health scores are transparent rule-based values driven by temperature, vibration, current, status, and downtime; this is not a trained machine-learning model.

## Demo workflow

Log in as Manager or Admin, use **Simulate machine risk** in the dashboard header, observe WELD-003 heat/vibration/health and the critical alert change, then select **Reset machine**. The live indicator and timestamp confirm Socket.IO updates without refresh.

## API

`POST /api/auth/login`, `GET /api/overview`, `GET /api/machines`, `GET /api/machines/:id/history`, `GET /api/alerts`, `PATCH /api/alerts/:id`, `GET /api/maintenance`, `GET /api/reports`, `POST /api/demo/risk`, `POST /api/demo/reset`.

## Future scope

Real robot gateway integration, historical ML models, richer maintenance scheduling, full PostgreSQL repositories, Redis caching, cloud deployment, and PDF exports are future enhancements.
