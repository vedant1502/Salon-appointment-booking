Glow & Grace Backend
====================

This backend is a small Python server for the Glow & Grace salon project.
It serves the static frontend locally and provides authentication APIs.

Run Locally
-----------

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
Default: localhost locally, 0.0.0.0 on Render

PORT
Default: 8000 locally; Render sets this automatically

DATABASE_URL
Optional. When set to a postgresql:// URL, the backend uses Supabase/Postgres instead of SQLite.

PGSSLMODE
Default: require

SECURE_COOKIES
Use true for hosted HTTPS frontend/backend calls.

GLOW_GRACE_ADMIN_EMAIL
Default: admin@glowgrace.com

GLOW_GRACE_ADMIN_PASSWORD
Default: Admin@12345

GLOW_GRACE_ADMIN_ROLE
Default: manager

Database
--------

Local SQLite database:

backend/data/salon.db

Hosted database:

Supabase/Postgres through DATABASE_URL

Stores:

- Customer accounts
- Admin accounts
- Session records
- Hashed customer security answers for password reset
- Live appointment/payment records
- Customer reviews
- Contact messages table placeholder
- Services table placeholder
- Staff table placeholder

Render Deployment
-----------------

Build Command:

pip install -r requirements.txt

Start Command:

python backend/server.py

Set DATABASE_URL in Render Environment. Do not put the real database password in GitHub.

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
GET  /api/appointments/my
POST /api/appointments
PUT  /api/appointments/:id
GET  /api/admin/appointments
PUT  /api/admin/appointments/:id
GET  /api/reviews
POST /api/reviews
GET  /api/admin/reviews
PUT  /api/admin/reviews/:id
GET  /api/live/summary

Notes
-----

- Customer login accepts email address or mobile number plus password.
- Customer password reset verifies registered email, registered mobile, selected security question, and security answer.
- OTP login has been removed.
- Google login is not enabled until OAuth credentials are added.
- Appointments, payments, reviews, happy clients count, and average rating are backed by the hosted database.
- Services, staff, and contact messages have backend tables ready, but their frontend pages still use browser localStorage until their migration phase.
- Notifications and some report cache data still use browser localStorage.