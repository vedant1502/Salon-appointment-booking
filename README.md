# Glow & Grace Salon Appointment Booking

Glow & Grace is a salon appointment booking project built with plain HTML, CSS, JavaScript, and a small Python backend. This project does not use React.

## What This Project Includes

- Customer website for browsing services, registering/logging in, booking appointments, paying, checking payment status, viewing appointments, updating profile details, and submitting reviews.
- Admin panel for dashboard metrics, appointments, services, staff, customers, payments, reviews, and reports.
- Python backend for customer/admin authentication, sessions, and profile updates.
- Browser localStorage for salon activity data such as appointments, payments, services, staff, reviews, notifications, and reports.
- SQLite database for accounts and login sessions.

## Run Locally

Run the backend server from the project root:

```powershell
python backend/server.py
```

Then open:

```text
http://localhost:8000/src/customer/home-page.html
```

The backend serves files from `frontend/`, so use the `localhost:8000` URLs instead of opening HTML files directly.

## Main URLs

Customer:

```text
http://localhost:8000/src/customer/home-page.html
http://localhost:8000/src/customer/login-register.html
http://localhost:8000/src/customer/forgot-password.html
http://localhost:8000/src/customer/booking.html
http://localhost:8000/src/customer/my-appointments.html
http://localhost:8000/src/customer/payment-status.html
```

Admin:

```text
http://localhost:8000/src/admin/admin-login.html
http://localhost:8000/src/admin/dashboard.html
http://localhost:8000/src/admin/manage-appointments.html
```

## Default Admin Login

```text
Email: admin@glowgrace.com
Password: Admin@12345
Role: manager
```

Before real use, change the password with an environment variable:

```powershell
$env:GLOW_GRACE_ADMIN_PASSWORD="your-strong-password"
python backend/server.py
```

Optional admin settings:

```powershell
$env:GLOW_GRACE_ADMIN_EMAIL="owner@example.com"
$env:GLOW_GRACE_ADMIN_ROLE="manager"
$env:HOST="localhost"
$env:PORT="8000"
python backend/server.py
```

## Login System

Customers register with:

- Full name
- Email address
- Mobile number
- Password
- Security question and private answer

Customers can log in with either the same email address or the same mobile number used during registration. OTP login has been removed.

Forgot password uses the registered email address, registered mobile number, selected security question, and saved security answer. If those match, the customer can set and confirm a new password.

Admin login uses the seeded admin account stored in SQLite.

Google sign-in is not enabled yet. The backend returns a setup-required message until a Google OAuth client ID is added.

## Booking And Payment Flow

1. Customer chooses service, stylist, date, and time.
2. Customer reviews the booking summary.
3. Customer continues to payment.
4. Clicking `Pay now` confirms and saves the appointment.
5. The appointment appears in Customer My Appointments and Admin Appointments.
6. Payment Status shows payment history. Receipt details appear only after clicking `View`.

## Data Storage

SQLite backend database:

```text
backend/data/salon.db
```

Stores:

- Customer accounts
- Admin accounts
- Login sessions
- Hashed security answers for customer password reset

Browser localStorage stores app activity data:

- Appointments and payment records
- Services
- Staff
- Reviews
- Notifications
- Contact messages
- Admin activity date
- Customer profile display data

Because activity data is in localStorage, it is tied to the browser profile being used.

## Folder Structure

```text
backend/
  server.py
  data/

frontend/
  public/
  src/
    admin/
    customer/
    javascript/
      admin/
      customer/
    styles/
      admin/
      customer/
```

## Useful Notes

- Keep using `python backend/server.py` as the local server.
- If a CSS/JS change does not show, refresh the page. Many pages use cache-busting query strings.
- If the project folder is renamed, start the server again from the renamed folder.
- If port `8000` is already busy, run with another port:

```powershell
$env:PORT="8001"
python backend/server.py
```
