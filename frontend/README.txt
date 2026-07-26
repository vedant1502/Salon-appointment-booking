Glow & Grace Frontend
=====================

This frontend is built with plain HTML, CSS, and JavaScript. It does not use React.

Run it locally through the backend server:

python backend/server.py

Then open:

http://localhost:8000/src/customer/home-page.html

Do not open the HTML files directly when testing login, because authentication uses backend API routes and cookies.

Hosted Backend URL
------------------

The deployed Vercel frontend reads the backend URL from:

src/javascript/backend-config.js

After deploying the backend on Render, set:

window.GLOW_GRACE_BACKEND_URL = "https://your-service-name.onrender.com";

Leave it blank for local development.

Folders
-------

public/
Static entry page.

src/customer/
Customer-facing pages.

src/admin/
Admin panel pages.

src/javascript/customer/
Customer page scripts.

src/javascript/admin/
Admin page scripts.

src/styles/customer/
Customer page styles.

src/styles/admin/
Admin page styles.

Important Customer Pages
------------------------

src/customer/home-page.html
src/customer/login-register.html
src/customer/forgot-password.html
src/customer/booking.html
src/customer/booking-summary.html
src/customer/payment.html
src/customer/payment-status.html
src/customer/my-appointments.html
src/customer/profile.html
src/customer/reviews-ratings.html

Important Admin Pages
---------------------

src/admin/admin-login.html
src/admin/dashboard.html
src/admin/manage-appointments.html
src/admin/manage-payments.html
src/admin/manage-services.html
src/admin/manage-staff.html
src/admin/customer-management.html
src/admin/manage-reviews.html
src/admin/reports.html

Shared Behavior
---------------

- Customer and admin theme switching uses localStorage key: glow-grace-theme
- Customer authentication uses backend sessions plus local profile cache.
- Customer password reset uses registered email, registered mobile, security question, and security answer.
- Admin authentication uses backend sessions.
- Appointment and payment records use localStorage key: glow-grace-appointments
- Activity date selection uses localStorage key: glow-grace-admin-activity-date
- Native date/time/search/select icons are handled in shared mobile-polish.css files for light and dark mode visibility.

Development Notes
-----------------

- Keep customer page CSS in src/styles/customer/.
- Keep admin page CSS in src/styles/admin/.
- Keep customer JS in src/javascript/customer/.
- Keep admin JS in src/javascript/admin/.
- Use cache-busting query strings on CSS/JS links when browser refresh does not pick up a change.