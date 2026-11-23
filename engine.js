/* MakeMyTrip booking engine – runs in the browser and in Node (for tests). */
(function (root) {
  "use strict";
  class BookingError extends Error {}
  const fail = (msg) => { throw new BookingError(msg); };
  const round2 = (n) => Math.round(n * 100) / 100;
  const EMAIL = /^[\w.+-]+@[\w-]+\.[\w.]+$/;
  const MAX_QTY = 6;
  const COUPONS = { FIRST10: { pct: 0.10, cap: 500, min: 2000 },
                    SAVE20: { pct: 0.20, cap: 1000, min: 5000 } };
  const FEES = { FLIGHT: 0.10, BUS: 0.05, HOTEL: 0.20 };       // cancellation fee
  const ADMIN = { email: "admin@makemytrip.com", password: "admin123" };

  // small non-cryptographic hash: enough for a client-side demo (see limitations)
  const hash = (s) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  };

  class Product {                       // base class: pid, name, city, dest, price, stock, depart
    constructor(o) { Object.assign(this, o); }
    quote(qty) { return this.price * qty; }
  }
  class Flight extends Product { get kind() { return "FLIGHT"; } }
  class Bus extends Product { get kind() { return "BUS"; } }
  class Hotel extends Product {
    get kind() { return "HOTEL"; }
    quote(qty, nights = 1) { return this.price * qty * nights; }
  }
  const CLASSES = { FLIGHT: Flight, BUS: Bus, HOTEL: Hotel };
  const makeProduct = ({ kind, ...rest }) => {
    const K = CLASSES[String(kind).toUpperCase()];
    return K ? new K(rest) : fail("Unknown item type");
  };

  class MakeMyTrip {
    constructor(state) {
      this.users = {}; this.products = {}; this.bookings = {}; this.nextId = 100001;
      if (state) {
        this.users = state.users; this.bookings = state.bookings; this.nextId = state.nextId;
        for (const p of Object.values(state.products)) this.products[p.pid] = makeProduct(p);
      }
    }
    snapshot() {
      const products = {};
      for (const [k, p] of Object.entries(this.products)) products[k] = { ...p, kind: p.kind };
      return JSON.parse(JSON.stringify({ users: this.users, products, bookings: this.bookings, nextId: this.nextId }));
    }

    /* ---------- users ---------- */
    register(name, email, wallet = 0, password = "") {
      if (!String(name).trim()) fail("Name required");
      if (!EMAIL.test(email)) fail("Invalid email");
      if (this.users[email]) fail("Email already registered");
      if (password && password.length < 6) fail("Password must be at least 6 characters");
      return (this.users[email] = { name: name.trim(), email, wallet, pwHash: password ? hash(password) : "" });
    }
    login(email, password) {
      const u = this.users[email];
      if (!u || !u.pwHash || u.pwHash !== hash(password)) fail("Invalid email or password");
      return u;
    }
    adminLogin(email, password) {
      if (email !== ADMIN.email || password !== ADMIN.password) fail("Invalid admin credentials");
      return true;
    }

    /* ---------- inventory (admin) ---------- */
    addProduct(o) {
      if (!o.pid || this.products[o.pid] || !String(o.name || "").trim() || !String(o.city || "").trim()
          || !(o.price > 0) || !(o.stock >= 0)) fail("Invalid or duplicate inventory item");
      return (this.products[o.pid] = makeProduct({ dest: "", depart: "", ...o }));
    }
    updateProduct(pid, { price, stock } = {}) {
      const p = this.products[pid] || fail("Item not found");
      if ((price !== undefined && !(price > 0)) || (stock !== undefined && !(stock >= 0))) fail("Invalid price or stock");
      if (price !== undefined) p.price = price;
      if (stock !== undefined) p.stock = stock;
      return p;
    }
    removeProduct(pid) {
      if (!this.products[pid]) fail("Item not found");
      delete this.products[pid];
    }

    /* ---------- search / booking ---------- */
    search(kind, city = "", dest = "", maxPrice = null) {
      const k = String(kind).toUpperCase(), c = city.trim().toLowerCase(), d = dest.trim().toLowerCase();
      return Object.values(this.products).filter((p) =>
        p.kind === k && (!c || p.city.toLowerCase() === c) && (!d || p.dest.toLowerCase() === d)
        && (maxPrice === null || maxPrice === "" || p.price <= Number(maxPrice)) && p.stock > 0);
    }
    quote(pid, qty = 1, nights = 1, coupon = "") {          // price check without booking
      const p = this.products[pid] || fail("Item not found");
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY || !Number.isInteger(nights) || nights < 1)
        fail("Invalid quantity or nights");
      if (p.stock < qty) fail("Not enough availability");
      let amount = p.quote(qty, nights);
      if (coupon) {
        const c = COUPONS[coupon] || fail("Invalid coupon");
        if (amount < c.min) fail(`Coupon needs minimum Rs.${c.min}`);
        amount -= Math.min(amount * c.pct, c.cap);
      }
      return round2(amount);
    }
    book(email, pid, qty = 1, nights = 1, coupon = "") {
      if (!this.users[email]) fail("User not registered");
      const amount = this.quote(pid, qty, nights, coupon), p = this.products[pid];
      p.stock -= qty;
      const b = { bid: "MMT" + this.nextId++, email, pid, item: p.name, kind: p.kind, qty, nights,
                  amount, coupon, status: "PENDING", paid: 0, refund: 0, created: new Date().toISOString() };
      return (this.bookings[b.bid] = b);
    }
    _get(bid) { return this.bookings[bid] || fail("Booking not found"); }
    pay(bid, method, card = "") {
      const b = this._get(bid), u = this.users[b.email];
      if (b.status !== "PENDING") fail("Booking is not awaiting payment");
      if (!["UPI", "CARD", "WALLET"].includes(method)) fail("Unsupported payment method");
      if (method === "CARD" && !/^\d{16}$/.test(card)) fail("Invalid card number");
      if (method === "WALLET") {
        if (u.wallet < b.amount) fail("Insufficient wallet balance");
        u.wallet = round2(u.wallet - b.amount);
      }
      b.paid = b.amount; b.status = "CONFIRMED"; b.method = method;
      return b;
    }
    cancel(bid, email = null) {                     // email = null → admin cancel
      const b = this._get(bid);
      if (email !== null && b.email !== email) fail("This booking belongs to another user");
      if (b.status === "CANCELLED") fail("Booking already cancelled");
      const refund = round2(b.paid * (1 - FEES[b.kind]));
      this.users[b.email].wallet = round2(this.users[b.email].wallet + refund);
      if (this.products[b.pid]) this.products[b.pid].stock += b.qty;
      b.status = "CANCELLED"; b.refund = refund;
      return refund;
    }
    bookingsOf(email) { return Object.values(this.bookings).filter((b) => b.email === email); }
    stats() {
      const live = Object.values(this.bookings).filter((b) => b.status === "CONFIRMED");
      return { users: Object.keys(this.users).length, items: Object.keys(this.products).length,
               bookings: Object.keys(this.bookings).length, revenue: live.reduce((s, b) => s + b.paid, 0) };
    }

    static seeded() {                               // demo data for the website
      const m = new MakeMyTrip();
      m.register("Tanmay", "tanmay@example.com", 20000, "tanmay123");
      const rows = [
        ["F1", "FLIGHT", "Air India AI101", "BLR", "DEL", 5000, 8, "06:15"],
        ["F2", "FLIGHT", "IndiGo 6E202", "BLR", "DEL", 4200, 12, "18:00"],
        ["F3", "FLIGHT", "Vistara UK810", "BLR", "DEL", 6100, 5, "09:40"],
        ["F4", "FLIGHT", "IndiGo 6E505", "BLR", "BOM", 3800, 10, "07:30"],
        ["F5", "FLIGHT", "Air India AI644", "BLR", "BOM", 4500, 6, "20:10"],
        ["F6", "FLIGHT", "IndiGo 6E331", "DEL", "BLR", 4600, 9, "11:20"],
        ["H1", "HOTEL", "Lakeview Residency", "BLR", "", 4000, 6, "Check-in 12:00"],
        ["H2", "HOTEL", "Garden City Suites", "BLR", "", 6500, 4, "Check-in 14:00"],
        ["H3", "HOTEL", "Metro Stay Inn", "BLR", "", 2800, 10, "Check-in 12:00"],
        ["H4", "HOTEL", "Palm Beach Resort", "GOI", "", 7200, 5, "Check-in 14:00"],
        ["B1", "BUS", "Kaveri Express", "BLR", "HYD", 900, 20, "21:30"],
        ["B2", "BUS", "Deccan Voyager (Sleeper)", "BLR", "HYD", 1400, 12, "22:15"],
        ["B3", "BUS", "Coastal Travels", "BLR", "GOI", 1100, 15, "20:00"],
      ];
      rows.forEach(([pid, kind, name, city, dest, price, stock, depart]) =>
        m.addProduct({ pid, kind, name, city, dest, price, stock, depart }));
      return m;
    }
  }

  const api = { MakeMyTrip, BookingError, COUPONS, FEES, MAX_QTY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MMT = api;
})(typeof window !== "undefined" ? window : globalThis);
