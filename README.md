# MakeMyTrip – Online Travel Booking Website with Admin Portal

CSC203B Software Development Fundamentals – Assignment (Part A).
Built with plain **HTML, CSS and JavaScript** (no framework, no server needed).

## Live demo
- Website: https://makemytripdem0.netlify.app          <!-- edit: paste your Netlify link -->
- Admin portal: https://makemytripdem0.netlify.app/admin.html   <!-- edit: same link + /admin.html -->
- Source code: https://github.com/Tanmay2049/makemytripReport

Demo logins:
- Traveller: `tanmay@example.com` / `tanmay123` (or register a new account)
- Admin: `admin@makemytrip.com` / `admin123`

> Data is stored in each visitor's browser (`localStorage`), so the website and the admin portal share bookings only within the same browser. The admin portal has a "Reset demo data" button.

## Run locally
Open `index.html` in Chrome/Edge/Firefox (double-click it), or serve the folder:
```bash
python -m http.server 8000     # then open http://localhost:8000
```

## Features
**Traveller:** register/login, search flights, hotels and buses (route/city + max price), book with quantity or nights, coupons `FIRST10` and `SAVE20`, pay by UPI / card / wallet (simulated), My Trips with pay-later and cancel (refund to wallet: flight 10% fee, bus 5%, hotel 20%).

**Admin:** protected login, dashboard (users, items, bookings, revenue), add / edit price & stock / delete inventory, view all bookings and cancel any of them.

## Files
| File | Purpose |
|---|---|
| `index.html`, `app.js` | Traveller website |
| `admin.html`, `admin.js` | Admin portal |
| `style.css` | Shared styles |
| `engine.js` | Booking engine (rules, validation, pricing, refunds) |
| `store.js` | Saves/loads engine state in localStorage |
| `test_engine.js` | 36 unit tests |

## Tests
Needs Node.js 18+ (no packages):
```bash
node --test test_engine.js
```

## Limitations
Browser-only storage (no server/database), simulated payments, demo-grade admin credentials and password hashing, no concurrency control.
