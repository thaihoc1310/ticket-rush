# TicketRush: Online Ticket Booking System Requirements

---

## 1. Evaluation Criteria

| No | Criteria | Weight |
| :--- | :--- | :--- |
| **1** | **Features & Implemented Functionalities** | **0.35** |
| **2** | **Design**: Logic and User-friendliness | **0.1** |
| **3** | **UI/UX**: Responsive, modern, aesthetically pleasing, and strong brand identity | **0.2** |
| **4** | **Performance**: Use Fetch or AJAX for partial loading (no page reloads), Backend API, JSON data usage, and Frontend DOM updates. | **0.15** |
| **5** | **Coding Style**: Use of design patterns, separation of UI and Business Logic, package organization, code documentation, etc. | **0.05** |
| **6** | **Input Handling**: Validation, auto-fill, suggestions, data conversion, etc. | **0.05** |
| **7** | **Security**: Authentication, session management, access control, encryption, etc. | **0.05** |
| **8** | **URL Rewriting and/or Routing** | **0.05** |
| **9** | **Database Operations**: OOP-based database interaction and database independence | **0.05** |

---

## 2. General Overview

**TicketRush** is an electronic ticket distribution platform built and operated by an Event Organizer.

The system allows the organizer to post music/entertainment events, set up intuitive seating charts, and sell tickets online to the public. The project's core focus is building a system capable of **high concurrency**, handling thousands of users simultaneously trying to secure a limited number of tickets during a short period (**flash sale**).

---

## 3. Business Roles & Functionalities

The system consists of two primary roles:

### **Customer (Audience)**
* **Search & Discover**: Find and view event details and seating arrangements.
* **Booking**: Select seats, hold them (within a specified time limit), and proceed to checkout.
* **Management**: Receive and manage electronic tickets (QR Codes).

### **Admin (System Owner / Organizer)**
* **Platform Management**: Full administrative control over the platform.
* **Event Configuration**: Create new events and configure seat matrices (assigning zones and prices to specific seats).
* **Real-time Dashboard**: Monitor revenue fluctuations and seat occupancy status in real-time.
* **Analytics**: View audience statistics by age and gender to understand market trends.

---

## 4. Technical Requirements

### 4.1. Interactive Seating Map
The frontend must provide an intuitive seat selection interface.
* **Admin Setup**: Ability to define a "Seat Matrix" (e.g., Zone A: 10 rows, 15 seats per row).
* **User Interaction**: Customers click on seats to select.
* **Real-time Updates**: The interface must update seat statuses (e.g., a seat turns from green to gray if another user has just reserved it) without a page refresh (using **Polling** or **WebSockets**).



### 4.2. Database Concurrency
This is a critical requirement to ensure a single seat is never sold to multiple people:
* **Locking Mechanisms**: Mandatory application of **Database Transactions** or **Row Locking** when a user "clicks to hold a seat."
* **Race Condition Prevention**: If two users click the same seat (VIP-A1) at the exact same millisecond (09:00:00.001), only one must succeed in holding the seat.

### 4.3. Ticket Lifecycle Management
Tickets transition through several states:
1.  **Available**: Open for purchase.
2.  **Locked**: Reserved temporarily while waiting for payment.
3.  **Sold**: Successfully paid for.
4.  **Released**: Returned to the market if the hold timer expires.

> **Note**: Customers have **10 minutes** to complete payment. A background mechanism (**Cronjob** or **Background Worker**) must scan and automatically "release" seats that have exceeded the lock duration without payment.
> 
> *Constraint: Real payment gateway integration is NOT required. The "Checkout" function only needs to display the order; clicking "CONFIRM" will simulate a successful payment.*



### 4.4. Advanced Challenge: Virtual Queue
Design a **Virtual Queue** algorithm to handle traffic spikes:
* **Mechanism**: When traffic exceeds the database's capacity, the system prevents a crash by automatically redirecting users to a **"Waiting Room"** page.
* **UI Display**: "You are at position 105 in the queue. Please do not refresh the page..."
* **Access Control**: The system grants access tokens to groups of users (e.g., 50 users per batch) to enter the seat selection screen sequentially.



