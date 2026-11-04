# Smart EV Charging Station Finder & Availability System
### Academic Mini Project — Traditional Software Engineering Architecture

An academic web application developed to help Electric Vehicle (EV) owners discover nearby charging stations, verify port availability, calculate charging costs with deterministic formulas, and reserve charging time slots. It also enables private charger owners to list their personal charging units in a peer-to-peer model.

---

## 1. Project Overview & Abstract

With the rising adoption of electric mobility, EV owners frequently face "range anxiety" and unpredictable queues at charging points. Concurrently, millions of residential EV wallbox chargers sit idle during working hours.

The **Smart EV Charging Station Finder & Availability System** resolves this through a centralized web platform that:
- Aggregates verified public fast-charging stations and private residential chargers.
- Provides search, distance indicators, and multi-parameter filtering (connector type, tariff, ownership, and availability status).
- Provides an **interactive mathematical charging cost calculator** based on battery capacity and percentage gain.
- Implements a **deterministic time-slot reservation system** with automated unique booking reference generation and receipt printing.
- Implements a **peer-to-peer charger listing portal** allowing homeowners to monetize idle chargers.

> **Academic Note:** This project strictly adheres to traditional software engineering principles. It employs **no artificial intelligence, machine learning, chatbots, or predictive black-box models**. All functionality is implemented using clean deterministic logic, predefined conditions, and relational state management stored in the browser's `localStorage`.

---

## 2. System Architecture & Tech Stack

```
+-------------------------------------------------------------------------+
|                              PRESENTATION LAYER                         |
|  index.html (Semantic HTML5) | styles.css (Responsive CSS3 Design System)|
|  - Minimalist White/Green UI (#2e7d32, #e8f5e9)                         |
|  - Hash-Based Single Page Application (SPA) Routing                     |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                            APPLICATION LOGIC                            |
|  js/app.js (Event Handlers, DOM Rendering, Filter Engine, Modal Manager)|
|  js/calculator.js (Deterministic Mathematical EV Energy Formulas)      |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                                DATA LAYER                               |
|  js/data.js (Station Schema, Vehicle Models, Demo Bookings)             |
|  Browser LocalStorage (ev_stations_db, ev_bookings_db, ev_user_session) |
|  Leaflet.js + OpenStreetMap (No API Key Required Geo-Visualization)     |
+-------------------------------------------------------------------------+
```

### Technology Breakdown
- **Frontend Core:** HTML5, CSS3, JavaScript (ES6+).
- **Styling Architecture:** Custom CSS variables, flexbox, CSS grid, mobile breakpoints (≤992px, ≤768px).
- **Mapping:** OpenStreetMap via Leaflet.js with custom color-coded map pins and offline fallback canvas.
- **Data Persistence:** Client-side Web Storage API (`localStorage`) allowing end-to-end demonstrations without server configuration.
- **Server:** Fully zero-dependency static application; can run directly via file protocol or any HTTP server (`npx serve`, Python `http.server`, or Apache/Nginx).

---

## 3. Implemented Modules (8 Main Pages)

### Page 1: Landing Page (`#landing`)
- **Brand Identity:** System title, green lightning logo badge.
- **Navigation Bar:** Home, Find Chargers, List Your Charger, My Bookings, Dashboard, About, and User Profile.
- **Hero Section:** Clean headline *"Find Your EV Charging Station Easily"*, brief subtitle, call-to-action buttons, and real-time station metrics.
- **3 Core Feature Cards:**
  1. *Find Nearby Chargers:* Distance and connector filtering.
  2. *Check Availability:* Live color-coded port indicators (Available, Occupied, Offline).
  3. *Affordable Charging:* Transparent per-kWh tariffs with zero hidden fees.
- **How It Works:** 3-step procedural guide (Search -> Check & Calculate -> Book).
- **Academic Project Footer:** Project guidelines, technology statement, and disclaimers.

### Page 2: User Dashboard (`#dashboard`)
- **Welcome Card:** Displays active logged-in user name and role badge (EV Owner / Charger Provider).
- **Metrics Summary (4 Cards):**
  - Total Nearby Charging Stations
  - Currently Available Stations (green indicator)
  - Upcoming Scheduled Bookings count
  - Total Spent on Charging sessions (₹)
- **Quick Actions Bar:** 1-click access to Search, Book Next Slot, List Charger, and View Bookings.
- **Upcoming Scheduled Session Widget:** Detailed view of next confirmed booking with time, vehicle, and tariff.
- **Featured Stations List:** Quick-access list of top-rated stations.

### Page 3: Find Charging Stations (`#find-stations`)
- **Search Engine:** Filter by city (Delhi, Bengaluru, Mumbai, Pune, Hyderabad) or landmark text.
- **Multi-Parameter Filter Toolbar:**
  - *Ownership:* All, Public Stations, Private Peer Chargers.
  - *Connector Plug Type:* CCS2 DC Fast, Type 2 AC, 15A Socket, CHAdeMO.
  - *Availability:* Available Now, Occupied, Offline.
  - *Max Tariff Slider:* Under ₹12/kWh, Under ₹15/kWh, Any.
- **Interactive Geo Map:** Leaflet map with colored pins (🟢 Available, 🟠 Occupied, ⚪ Offline) and clickable popups with instant booking triggers.
- **Station Cards:** Name, address, distance (km), charging speed (kW), price per kWh, port count, and action buttons.

### Page 4: Charging Station Details (`#station-details`)
- Complete technical specifications table: Output kW, plug types, operating schedule, operator contact.
- Verified on-site amenities (Dedicated parking, CCTV, coffee shop, restrooms, Wi-Fi).
- **Interactive Cost & Charging Time Calculator:**
  - Select predefined EV models (Tata Nexon EV, MG ZS EV, Mahindra XUV400, Hyundai Ioniq 5, Ola S1 Pro, etc.) or custom battery capacity.
  - Sliders for Current Battery % and Target Battery %.
  - Live calculation showing Energy Needed (kWh), Est. Time (mins/hrs), and Total Cost (₹).

### Page 5: Booking Page (`#book`)
- Selected station summary banner.
- Date picker (minimum date: today, maximum: +7 days).
- **Available Time Slots Grid:** Predefined 1-hour slots. Slots already reserved in the database are dynamically disabled with `(Booked)` tags.
- Vehicle registration input with pattern validation.
- Energy requirement input with live price breakdown.
- **Confirmation Modal & Receipt:** Generates unique ID (e.g. `EV-BK-8021`), entry pass QR simulation, and print option.

### Page 6: List Your Private Charger (`#list-charger`)
- Form for homeowner hosts to monetize residential chargers:
  - Host name, contact number, charger title.
  - Street address, landmark, and city dropdown.
  - Charger type (Type 2 Wallbox, 15A Socket, CCS2 DC Compact).
  - Capacity (kW), price per unit (₹/kWh), and operating hours.
  - Amenities checklist (Gated parking, CCTV, shade).
- Validates and immediately prepends the new station to the live station database in `localStorage`.

### Page 7: My Bookings (`#my-bookings`)
- Filter tabs: `All Bookings`, `Upcoming / Confirmed`, `Completed`, `Cancelled`.
- Card list detailing booking ID, station address, slot time, vehicle number, and total tariff.
- **Cancellation Engine:** Cancelling an upcoming booking updates the status to `Cancelled` and immediately frees the time slot for other users.
- **Receipt Modal:** Displays formatted printable ticket.

### Page 8: Login and Registration (`#auth`)
- Switchable Sign In and Registration forms.
- Role selector: `EV Owner` or `Charger Provider`.
- One-click demo test buttons (`Rahul - EV Owner` and `Priya - Host`) for evaluation.

---

## 4. Mathematical Logic & Algorithms

All operations use explicit mathematical formulas without any black-box AI:

### A. Energy Required Formula
$$\text{Energy Required (kWh)} = \text{Battery Capacity (kWh)} \times \frac{\text{Target \%} - \text{Current \%}}{100}$$

### B. Total Charging Cost Formula
$$\text{Total Cost (₹)} = \text{Energy Required (kWh)} \times \text{Price per kWh (₹)}$$

### C. Estimated Charging Duration
$$\text{Charging Time (Hours)} = \frac{\text{Energy Required (kWh)}}{\text{Charger Output Power (kW)}}$$
$$\text{Charging Time (Minutes)} = \text{Charging Time (Hours)} \times 60$$

### D. Slot Collision Prevention Algorithm
```javascript
// Predefined schedule verification
const isSlotBooked = database.bookings.some(booking => 
  booking.stationId === targetStationId &&
  booking.bookingDate === targetDate &&
  booking.timeSlot === selectedSlot &&
  booking.status !== "Cancelled"
);
// If isSlotBooked is true, disable button and prevent submission.
```

---

## 5. How to Run the Project

### Method 1: Direct Browser Launch (Recommended for Viva)
1. Navigate to the project directory: `c:\Users\Asus\Downloads\sauraav\`.
2. Double-click `index.html` or right-click -> **Open with Google Chrome / Microsoft Edge / Mozilla Firefox**.
3. The application runs immediately with zero installation required!

### Method 2: Local HTTP Server
If demonstrating via localhost:
```bash
# Using Node / npx
npx serve .

# Or using Python 3
python -m http.server 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 6. Project File Structure

```
sauraav/
├── index.html           # Main semantic SPA markup for all 8 views
├── package.json         # Project metadata and quick-run scripts
├── README.md            # Academic project report and documentation
├── assets/
│   └── logo.svg         # Clean EV charging station vector logo
├── css/
│   └── styles.css       # Clean responsive design system (Green/White theme)
└── js/
    ├── data.js          # Relational seed data (stations, vehicles, demo bookings)
    ├── calculator.js    # Deterministic mathematical formulas module
    └── app.js           # Controller, DOM routing, filter engine, localStorage store
```

---

## 7. Viva Voce Questions & Answers Guide

**Q1: Why did you not use Machine Learning or AI in this project?**  
*Answer:* EV charging slot reservation and billing require 100% deterministic, predictable, and legally auditable calculations. Using rule-based software engineering guarantees exact billing ($Cost = kWh \times Tariff$), prevents non-deterministic pricing hallucinations, and ensures that slot booking collisions are strictly prevented using boolean schedule logic.

**Q2: How does the system handle real-time slot conflicts?**  
*Answer:* When a user picks a date and station, the system queries existing records in the database. Any slot matching `stationId`, `date`, and `status === 'Confirmed'` has its button disabled in the UI. Upon booking submission, the record is stored atomically in `localStorage`.

**Q3: How does the private charger listing feature benefit the EV ecosystem?**  
*Answer:* Public DC fast chargers can have long waiting lines. Residential owners with wallbox chargers (3.3 kW - 11 kW) can share their chargers when idle (e.g. overnight or during work hours), earning secondary income while expanding decentralised charging infrastructure.

**Q4: How is data persisted without a dedicated SQL backend?**  
*Answer:* The application implements the Web Storage API (`window.localStorage`). Data schemas are serialised as structured JSON objects (`ev_stations_db`, `ev_bookings_db`, `ev_user_session`). Any private charger added or slot booked persists across page reloads and browser restarts.

---

## 8. Academic Project Verification

- [x] Clean minimal UI with white background and green accent palette (`#2e7d32`, `#e8f5e9`).
- [x] Responsive layout tested for mobile, tablet, and desktop views.
- [x] Zero AI dependencies or external AI API calls.
- [x] Complete working implementation of all 8 required pages.
- [x] Interactive mathematical calculator with instant visual feedback.
- [x] Realistic seed database covering major metropolitan cities.
