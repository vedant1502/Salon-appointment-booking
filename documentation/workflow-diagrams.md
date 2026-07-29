# 3.2 Workflow Diagrams - Glow & Grace Salon

This section follows the workflow-diagram style from the field project documentation format. Each flow includes a short flow representation and an editable Mermaid diagram.

## 3.2.1 Customer Account and Login Flow

This flow shows how a customer enters the website, creates or accesses an account, and reaches the customer side of the system.

**Flow Representation:**

Open Website -> Register or Login -> Backend Verifies Account -> Session Created -> Customer Home Page -> Profile and Bookings Available

```mermaid
flowchart LR
    A["Open Website"]
    B["Register or Login"]
    C["Backend Verifies Account"]
    D["Session Created"]
    E["Customer Home Page"]
    F["Profile and Bookings Available"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## 3.2.2 Customer Appointment Booking Flow

This flow explains how a logged-in customer books a salon appointment from service selection to final booking storage.

**Flow Representation:**

Customer Login -> Select Service -> Choose Stylist -> Select Date and Time -> Review Summary -> Continue to Payment -> Booking Saved

```mermaid
flowchart LR
    A["Customer Login"]
    B["Select Service"]
    C["Choose Stylist"]
    D["Select Date and Time"]
    E["Review Summary"]
    F["Continue to Payment"]
    G["Booking Saved"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
```

## 3.2.3 Payment Processing Flow

This flow shows how payment information is handled and how the payment status page displays receipt details after payment.

**Flow Representation:**

Booking Summary -> Select Payment Method -> UPI QR, Card, or Pay at Salon -> Click Pay Now -> Backend Stores Payment Status -> Payment Status and Receipt

```mermaid
flowchart LR
    A["Booking Summary"]
    B["Select Payment Method"]
    C["UPI QR, Card, or Pay at Salon"]
    D["Click Pay Now"]
    E["Backend Stores Payment Status"]
    F["Payment Status and Receipt"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## 3.2.4 Admin Management Flow

This flow describes the admin side where salon staff monitor daily data, update appointment/payment status, and review reports.

**Flow Representation:**

Admin Login -> Dashboard -> Select Activity Date -> View Live Data -> Manage Appointments, Payments, Reviews -> Update Status and Reports

```mermaid
flowchart LR
    A["Admin Login"]
    B["Dashboard"]
    C["Select Activity Date"]
    D["View Live Data"]
    E["Manage Appointments, Payments, Reviews"]
    F["Update Status and Reports"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## 3.2.5 Review Management Flow

This flow shows how customer reviews are submitted, stored, displayed publicly, and controlled from the admin panel.

**Flow Representation:**

Customer Login -> Open Reviews Page -> Submit Rating and Review -> Backend Saves Review -> Public Reviews Updated -> Admin Approves or Hides Review

```mermaid
flowchart LR
    A["Customer Login"]
    B["Open Reviews Page"]
    C["Submit Rating and Review"]
    D["Backend Saves Review"]
    E["Public Reviews Updated"]
    F["Admin Approves or Hides Review"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## 3.2.6 Live Data and Database Flow

This flow explains how frontend pages communicate with the hosted backend and live database for appointments, payments, and reviews.

**Flow Representation:**

Customer or Admin Page -> live-data.js API Request -> Render Python Backend -> Supabase/Postgres Database -> JSON Response -> Updated Website UI

```mermaid
flowchart LR
    A["Customer or Admin Page"]
    B["live-data.js API Request"]
    C["Render Python Backend"]
    D["Supabase/Postgres Database"]
    E["JSON Response"]
    F["Updated Website UI"]
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

## System Workflow Explanation

The system works through two main interfaces: the customer website and the admin panel. Customers register or login, book appointments, complete payment or choose pay at salon, and then view their appointment and payment status. Admin users login separately, view all live appointment data, filter activity by date, manage payment and appointment status, and review customer feedback. The frontend communicates with the Python backend through API requests, and the backend stores live data in the Supabase/Postgres database.