Glow & Grace Backend
====================

This backend is a small Python server for the Glow & Grace salon project.
It serves the static frontend and provides authentication APIs.

Run
---

From the project root:

python backend/server.py

Open:

http://localhost:8000/src/customer/home-page.html

Default Admin
-------------

Email: admin@glowgrace.com
Password: Admin@12345
Role: manager

Change this password before real use:

$env:GLOW_GRACE_ADMIN_PASSWORD="your-strong-password"
python backend/server.py

Environment Variables
---------------------

HOST
Default: localhost

PORT
Default: 8000

GLOW_GRACE_ADMIN_EMAIL
Default: admin@glowgrace.com

GLOW_GRACE_ADMIN_PASSWORD
Default: Admin@12345

GLOW_GRACE_ADMIN_ROLE
Default: manager

Database
--------

SQLite database:

backend/data/salon.db

Stores:

- Customer accounts
- Admin accounts
- Session records
- Hashed customer security answers for password reset

Main API Routes
---------------

GET  /api/health
GET  /api/auth/me
POST /api/auth/register
POST /api/auth/login
POST /api/auth/admin-login
POST /api/auth/google-login
POST /api/auth/verify-recovery
POST /api/auth/reset-password
POST /api/auth/logout
PUT  /api/auth/profile

Notes
-----

- Customer login accepts email address or mobile number plus password.
- Customer password reset verifies registered email, registered mobile, selected security question, and security answer.
- OTP login has been removed.
- Google login is not enabled until OAuth credentials are added.
- Appointments, payments, services, staff, reviews, and reports are currently stored in browser localStorage by the frontend.
