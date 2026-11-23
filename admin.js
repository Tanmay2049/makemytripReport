/* Admin portal: dashboard, inventory management, all bookings. Logic lives in engine.js. */
(() => {
  "use strict";
  const money = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => document.querySelector(s);
  let admin = sessionStorage.getItem("mmt_admin") === "1";
  let mmt = store.load();

  function toast(msg, type = "") {
    const t = $("#toast"); t.textContent = msg; t.className = "show " + type;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 2600);
  }
  // run an admin action on fresh data, save, re-render
  function act(fn, okMsg) {
    mmt = store.load();
    try { fn(); store.save(mmt); render(); if (okMsg) toast(okMsg, "ok"); }
    catch (e) { toast(e.message, "bad"); }
  }

  function loginView() {
    $("#userbox").innerHTML = "";
    $("#app").innerHTML = `<form class="login-card" id="login"><h2>Admin sign in</h2><div class="muted">Restricted area – staff only.</div>
      <label>Email<input name="email" type="email" required value="admin@makemytrip.com"></label>
      <label>Password<input name="pw" type="password" required value="admin123"></label>
      <div class="err" id="err"></div><div class="actions"><button>Sign in</button></div>
      <div class="hint">Demo credentials: admin@makemytrip.com / admin123</div></form>`;
    $("#login").onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      try { mmt.adminLogin(f.get("email"), f.get("pw")); admin = true; sessionStorage.setItem("mmt_admin", "1"); render(); }
      catch (er) { $("#err").textContent = er.message; }
    };
  }

  function dashboard() {
    mmt = store.load();
    const s = mmt.stats(), items = Object.values(mmt.products), bks = Object.values(mmt.bookings).reverse();
    $("#userbox").innerHTML = '<span class="chip">Admin</span><button class="ghost small" id="logout" style="background:none;color:#fff;border-color:#9db4d6">Sign out</button>';
    $("#logout").onclick = () => { admin = false; sessionStorage.removeItem("mmt_admin"); render(); };
    $("#app").innerHTML = `
      <div class="stats"><div class="stat"><span>Registered users</span><b>${s.users}</b></div><div class="stat"><span>Inventory items</span><b>${s.items}</b></div>
        <div class="stat"><span>Total bookings</span><b>${s.bookings}</b></div><div class="stat"><span>Revenue (confirmed)</span><b>${money(s.revenue)}</b></div></div>

      <div class="panel"><h2>Inventory</h2><table><tr><th>ID</th><th>Type</th><th>Name</th><th>Route / City</th><th>Departs</th><th>Price (₹)</th><th>Stock</th><th></th></tr>
      ${items.map((p) => `<tr><td><b>${esc(p.pid)}</b></td><td>${p.kind}</td><td>${esc(p.name)}</td><td>${esc(p.city)}${p.dest ? " → " + esc(p.dest) : ""}</td><td>${esc(p.depart)}</td>
        <td><input type="number" min="1" value="${p.price}" data-price="${esc(p.pid)}"></td><td><input type="number" min="0" value="${p.stock}" data-stock="${esc(p.pid)}"></td>
        <td style="white-space:nowrap"><button class="small" data-save="${esc(p.pid)}">Save</button> <button class="danger small" data-del="${esc(p.pid)}">Delete</button></td></tr>`).join("")}</table></div>

      <div class="panel"><h2>Add inventory</h2><form id="add"><div class="addgrid">
        <label>Type<select name="kind"><option>FLIGHT</option><option>HOTEL</option><option>BUS</option></select></label>
        <label>ID<input name="pid" required placeholder="e.g. F7"></label>
        <label>Name<input name="name" required placeholder="e.g. IndiGo 6E707"></label>
        <label>From / City<input name="city" required placeholder="BLR"></label>
        <label>To (not for hotels)<input name="dest" placeholder="DEL"></label>
        <label>Departs / Check-in<input name="depart" placeholder="08:45"></label>
        <label>Price (₹)<input name="price" type="number" min="1" required></label>
        <label>Stock<input name="stock" type="number" min="0" required></label></div>
        <div class="actions"><button>Add item</button></div></form></div>

      <div class="panel"><h2>All bookings</h2>${bks.length ? `<table><tr><th>Booking</th><th>Customer</th><th>Item</th><th>Qty</th><th>Amount</th><th>Status</th><th></th></tr>
      ${bks.map((b) => `<tr><td><b>${b.bid}</b></td><td>${esc(b.email)}</td><td>${esc(b.item)}</td><td>${b.qty}${b.kind === "HOTEL" ? " × " + b.nights + "n" : ""}</td><td>${money(b.amount)}</td>
        <td><span class="status s-${b.status}">${b.status}</span></td><td style="text-align:right">${b.status !== "CANCELLED" ? `<button class="danger small" data-cancel="${b.bid}">Cancel</button>` : ""}</td></tr>`).join("")}</table>`
        : '<div class="muted">No bookings yet.</div>'}</div>
      <div style="text-align:right"><button class="danger small" id="reset">Reset demo data</button></div>`;

    $("#add").onsubmit = (e) => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      act(() => mmt.addProduct({ ...f, pid: f.pid.trim().toUpperCase(), price: +f.price, stock: +f.stock }), "Item added");
    };
    $("#reset").onclick = () => { if (confirm("Reset all data to the demo defaults?")) { mmt = store.reset(); render(); toast("Demo data restored", "ok"); } };
  }
  $("#app").addEventListener("click", (e) => {
    const d = e.target.dataset;
    if (d.save) act(() => mmt.updateProduct(d.save, { price: +document.querySelector(`[data-price="${d.save}"]`).value, stock: +document.querySelector(`[data-stock="${d.save}"]`).value }), "Saved " + d.save);
    if (d.del && confirm("Delete " + d.del + "?")) act(() => mmt.removeProduct(d.del), "Deleted " + d.del);
    if (d.cancel && confirm("Cancel booking " + d.cancel + "?")) act(() => mmt.cancel(d.cancel), "Booking cancelled and refunded");
  });
  function render() { admin ? dashboard() : loginView(); }
  render();
})();
