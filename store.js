/* Persists the booking engine in the browser (localStorage) so the website and admin portal share data. */
const store = (() => {
  const KEY = "mmt_state_v1";
  return {
    load() {
      try { const s = localStorage.getItem(KEY); if (s) return new MMT.MakeMyTrip(JSON.parse(s)); } catch (e) { /* fall through */ }
      const m = MMT.MakeMyTrip.seeded(); this.save(m); return m;
    },
    save(m) { localStorage.setItem(KEY, JSON.stringify(m.snapshot())); },
    reset() { localStorage.removeItem(KEY); return this.load(); },
  };
})();
