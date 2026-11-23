/* Traveller website: search, book, pay, cancel. All logic is in engine.js. */
(() => {
  "use strict";
  const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => document.querySelector(s);
  const ICON = {
    FLIGHT: '<svg viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
    HOTEL: '<svg viewBox="0 0 24 24"><path d="M3 21V7l9-4 9 4v14h-6v-6H9v6zM7 9v2h2V9zm4 0v2h2V9zm4 0v2h2V9z"/></svg>',
    BUS: '<svg viewBox="0 0 24 24"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4zm3.5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12z"/></svg>',
  };
  const LABEL = { FLIGHT: "Flights", HOTEL: "Hotels", BUS: "Buses" };
  let mmt = store.load();
  let me = localStorage.getItem("mmt_user");
  let kind = "FLIGHT", query = {};
  const sync = () => { mmt = store.load(); if (me && !mmt.users[me]) me = null; };

  function toast(msg, type = "") {
    const t = $("#toast"); t.textContent = msg; t.className = "show " + type;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 2600);
  }
  function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").hidden = false; }
  function closeModal() { $("#modal").hidden = true; }
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.dataset.close !== undefined) closeModal(); });

  /* ---------- header / auth ---------- */
  function renderUser() {
    const u = me && mmt.users[me];
    $("#userbox").innerHTML = u
      ? `<span class="chip">Wallet ${money(u.wallet)}</span><span>Hi, <b>${esc(u.name)}</b></span><button class="ghost small" id="logout">Logout</button>`
      : `<button class="small" id="loginBtn">Login / Register</button>`;
    if (u) $("#logout").onclick = () => { me = null; localStorage.removeItem("mmt_user"); renderUser(); route(); toast("Logged out"); };
    else $("#loginBtn").onclick = () => authModal();
  }
  function authModal(mode = "login", after = null) {
    const reg = mode === "register";
    openModal(`<h2>${reg ? "Create account" : "Welcome back"}</h2><p class="muted">${reg ? "Register to start booking." : "Login to book and manage trips."}</p>
      <form id="auth">${reg ? '<label>Name<input name="name" required></label>' : ""}
      <label>Email<input name="email" type="email" required value="${reg ? "" : "tanmay@example.com"}"></label>
      <label>Password<input name="pw" type="password" required minlength="6" value="${reg ? "" : "tanmay123"}"></label>
      <div class="err" id="err"></div>
      <div class="actions"><button type="button" class="ghost" id="swap">${reg ? "I have an account" : "New here? Register"}</button><button>${reg ? "Register" : "Login"}</button></div></form>`);
    $("#swap").onclick = () => authModal(reg ? "login" : "register", after);
    $("#auth").onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(e.target); sync();
      try {
        if (reg) mmt.register(f.get("name"), f.get("email"), 5000, f.get("pw")), store.save(mmt);
        const u = mmt.login(f.get("email"), f.get("pw"));
        me = u.email; localStorage.setItem("mmt_user", me); closeModal(); renderUser(); route();
        toast(reg ? "Account created – ₹5,000 welcome credit added" : "Logged in", "ok"); if (after) after();
      } catch (er) { $("#err").textContent = er.message; }
    };
  }

  /* ---------- search ---------- */
  function renderTabs() {
    $("#tabs").innerHTML = Object.keys(LABEL).map((k) => `<button type="button" data-k="${k}" class="${k === kind ? "on" : ""}">${ICON[k]}${LABEL[k]}</button>`).join("");
    const f = (n, l, ph) => `<label>${l}<input name="${n}" list="cities" placeholder="${ph}" autocomplete="off"></label>`;
    $("#fields").innerHTML = kind === "HOTEL" ? f("city", "City", "e.g. BLR") : f("city", "From", "e.g. BLR") + f("dest", "To", "e.g. DEL");
  }
  $("#tabs").onclick = (e) => { const b = e.target.closest("button"); if (b) { kind = b.dataset.k; query = {}; renderTabs(); renderResults(); } };
  $("#form").onsubmit = (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    query = { city: f.get("city") || "", dest: f.get("dest") || "", max: f.get("max") || "" }; renderResults();
  };
  function renderResults() {
    sync();
    const list = mmt.search(kind, query.city || "", query.dest || "", query.max || null);
    const route = query.city ? ` for ${esc(query.city.toUpperCase())}${query.dest ? " → " + esc(query.dest.toUpperCase()) : ""}` : "";
    $("#resHead").innerHTML = `${list.length} ${LABEL[kind].toLowerCase()} found${route}`;
    $("#results").innerHTML = list.length ? list.map((p) => `
      <article class="item"><div class="ico">${ICON[p.kind]}</div>
        <div class="info"><h3>${esc(p.name)}<span class="tag">${esc(p.pid)}</span></h3>
          <div class="muted">${p.kind === "HOTEL" ? esc(p.city) : esc(p.city) + " → " + esc(p.dest)} · ${esc(p.depart)}</div>
          ${p.stock <= 3 ? `<span class="low">Only ${p.stock} left</span>` : `<span class="muted">${p.stock} ${p.kind === "HOTEL" ? "rooms" : "seats"} available</span>`}</div>
        <div class="price"><b>${money(p.price)}</b><small>${p.kind === "HOTEL" ? "per room / night" : "per seat"}</small><button data-book="${esc(p.pid)}">Book</button></div></article>`).join("")
      : '<div class="empty">No results. Try a different route or a higher max price.</div>';
  }
  $("#results").onclick = (e) => {
    const pid = e.target.dataset.book; if (!pid) return;
    me ? bookModal(pid) : authModal("login", () => bookModal(pid));
  };

  /* ---------- booking + payment ---------- */
  function bookModal(pid) {
    sync(); const p = mmt.products[pid]; if (!p) return toast("Item not found", "bad");
    const hotel = p.kind === "HOTEL", max = Math.min(MMT.MAX_QTY, p.stock);
    openModal(`<h2>${esc(p.name)}</h2><div class="muted">${hotel ? esc(p.city) : esc(p.city) + " → " + esc(p.dest)} · ${esc(p.depart)} · ${money(p.price)} ${hotel ? "/ room / night" : "/ seat"}</div>
      <label>${hotel ? "Rooms" : "Seats"}<select id="qty">${Array.from({ length: max }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
      ${hotel ? '<label>Nights<input id="nights" type="number" min="1" value="1"></label>' : ""}
      <label>Coupon (optional)<input id="coupon" placeholder="FIRST10 or SAVE20" autocomplete="off"></label>
      <div class="total"><span>Total payable</span><b id="tot"></b></div><div class="err" id="err"></div>
      <div class="actions"><button class="ghost" data-close>Close</button><button id="go">Continue to payment</button></div>`);
    const args = () => [pid, +$("#qty").value, hotel ? +$("#nights").value : 1, $("#coupon").value.trim().toUpperCase()];
    const upd = () => {
      try { $("#tot").textContent = money(mmt.quote(...args())); $("#err").textContent = ""; $("#go").disabled = false; }
      catch (er) { $("#tot").textContent = "—"; $("#err").textContent = er.message; $("#go").disabled = true; }
    };
    ["#qty", "#coupon", "#nights"].forEach((s) => $(s) && $(s).addEventListener("input", upd)); upd();
    $("#go").onclick = () => {
      sync();
      try { const b = mmt.book(me, ...args()); store.save(mmt); renderResults(); payModal(b.bid); }
      catch (er) { $("#err").textContent = er.message; }
    };
  }
  function payModal(bid) {
    sync(); const b = mmt.bookings[bid], u = mmt.users[me];
    openModal(`<h2>Payment</h2><div class="muted">Booking ${b.bid} · ${esc(b.item)} × ${b.qty}${b.kind === "HOTEL" ? " · " + b.nights + " night(s)" : ""}</div>
      <div class="total"><span>Amount due</span><b>${money(b.amount)}</b></div>
      <div class="seg">${["UPI", "CARD", "WALLET"].map((m, i) => `<label><input type="radio" name="m" value="${m}" ${i ? "" : "checked"}>${m === "WALLET" ? "Wallet (" + money(u.wallet) + ")" : m}</label>`).join("")}</div>
      <label id="cardRow" hidden>Card number (16 digits)<input id="card" inputmode="numeric" maxlength="16" placeholder="4111111111111111"></label>
      <div class="hint">Payments are simulated – no real money moves.</div><div class="err" id="err"></div>
      <div class="actions"><button class="ghost" data-close>Pay later</button><button id="pay">Pay ${money(b.amount)}</button></div>`);
    const method = () => document.querySelector('input[name=m]:checked').value;
    document.querySelectorAll("input[name=m]").forEach((r) => (r.onchange = () => ($("#cardRow").hidden = method() !== "CARD")));
    $("#pay").onclick = () => {
      sync();
      try { mmt.pay(bid, method(), $("#card").value.trim()); store.save(mmt); renderUser(); confirmModal(bid); }
      catch (er) { $("#err").textContent = er.message; }
    };
  }
  function confirmModal(bid) {
    const b = mmt.bookings[bid];
    openModal(`<h2>Booking confirmed 🎉</h2><div class="ticket"><div class="big">${b.bid}</div>
      <div>${esc(b.item)} × ${b.qty}${b.kind === "HOTEL" ? " · " + b.nights + " night(s)" : ""}</div>
      <div class="muted">Paid ${money(b.paid)} via ${b.method}${b.coupon ? " · coupon " + esc(b.coupon) : ""}</div></div>
      <div class="actions"><button class="ghost" data-close>Close</button><button id="goTrips">View my trips</button></div>`);
    $("#goTrips").onclick = () => { closeModal(); location.hash = "#trips"; };
  }

  /* ---------- my trips ---------- */
  function renderTrips() {
    sync();
    if (!me) { $("#trips").innerHTML = '<div class="empty">Please login to see your trips.</div>'; return; }
    const list = mmt.bookingsOf(me).reverse();
    $("#trips").innerHTML = list.length ? `<div class="panel"><table><tr><th>Booking</th><th>Item</th><th>Qty</th><th>Amount</th><th>Status</th><th></th></tr>${list.map((b) => `
      <tr><td><b>${b.bid}</b></td><td>${esc(b.item)}${b.kind === "HOTEL" ? ` <span class="muted">(${b.nights} night${b.nights > 1 ? "s" : ""})</span>` : ""}</td><td>${b.qty}</td>
      <td>${money(b.amount)}${b.status === "CANCELLED" ? `<div class="muted">refunded ${money(b.refund)}</div>` : ""}</td>
      <td><span class="status s-${b.status}">${b.status}</span></td>
      <td style="text-align:right">${b.status === "PENDING" ? `<button class="small" data-pay="${b.bid}">Pay now</button> ` : ""}${b.status !== "CANCELLED" ? `<button class="danger small" data-cancel="${b.bid}">Cancel</button>` : ""}</td></tr>`).join("")}</table></div>`
      : '<div class="empty">No trips yet. Search and book your first one!</div>';
  }
  $("#trips").onclick = (e) => {
    const { pay, cancel } = e.target.dataset;
    if (pay) payModal(pay);
    if (cancel) {
      sync(); const b = mmt.bookings[cancel];
      const refund = Math.round(b.paid * (1 - MMT.FEES[b.kind]) * 100) / 100;
      if (!confirm(`Cancel ${b.bid}? You will get ${money(refund)} back in your wallet.`)) return;
      try { const r = mmt.cancel(cancel, me); store.save(mmt); renderUser(); renderTrips(); toast(`Cancelled – ${money(r)} refunded to wallet`, "ok"); }
      catch (er) { toast(er.message, "bad"); }
    }
  };

  /* ---------- routing ---------- */
  function route() {
    const trips = location.hash === "#trips";
    $("#view-search").hidden = trips; $("#view-trips").hidden = !trips;
    $("#nav-search").classList.toggle("on", !trips); $("#nav-trips").classList.toggle("on", trips);
    if (trips) renderTrips(); else renderResults();
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("storage", () => { sync(); renderUser(); route(); });
  renderTabs(); sync(); renderUser(); route();
})();
