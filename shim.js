// Phone-only storage: stands in for claude.use("db"/"user"/"downloads") using this browser's localStorage.
(function () {
  const PREFIX = "ht:";
  const ls = {
    get(p) { try { const v = localStorage.getItem(PREFIX + p); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; } },
    set(p, d) { localStorage.setItem(PREFIX + p, JSON.stringify(d)); },
    del(p) { localStorage.removeItem(PREFIX + p); },
    keys() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length)); } return out; }
  };
  const PLAY_POKER = {"cat":"Poker","id":"playpoker","min":null,"max":8,"name":"Playing Poker","pts":1,"tpw":7,"type":"Hours","days":{"np":false,"poker":true,"off":false}};
  const BEHAVIOR = {"cat":"Mind","id":"behavior","min":null,"name":"Behavior Training","pts":2,"tpw":7,"type":"Check","days":{"np":true,"poker":true,"off":false}};
  const STUDY = {"cat":"Poker","id":"study","min":null,"max":4,"name":"Study Drills or Online Play","pts":2,"tpw":7,"type":"Hours"};
  const SEED = {"start":"2027-01-01","target":13,"calories":2000,"sleepGoal":7.5,"goalWeight":null,"profitGoal":50000,"habits":[
    PLAY_POKER,
    {"cat":"Work","id":"deepwork","min":null,"name":"Deep Work 2hr","pts":2,"tpw":7,"type":"Check"},
    {"cat":"Health","id":"sleep","min":null,"name":"Sleep 7.5hr","pts":2,"tpw":7,"type":"Check"},
    {"cat":"Health","id":"cold","min":null,"name":"Cold / Heat Shock","pts":2,"tpw":7,"type":"Check"},
    STUDY,
    {"cat":"Mind","id":"journal","min":null,"name":"10 min Journaling","pts":1,"tpw":7,"type":"Check"},
    {"cat":"Health","id":"supps","min":null,"name":"Supplements","pts":1,"tpw":7,"type":"Check"},
    {"cat":"Sleep","id":"screens","min":null,"name":"No screens 30 min before bed","pts":1,"tpw":7,"type":"Check"},
    {"cat":"Mind","id":"goals","min":null,"name":"Reread Goals","pts":1,"tpw":7,"type":"Check"},
    {"cat":"Health","id":"yoga","min":null,"name":"Yoga / Stretch","pts":1,"tpw":4,"type":"Check"},
    {"cat":"Health","id":"sun","min":null,"name":"20 min Sunlight","pts":1,"tpw":7,"type":"Check"},
    {"cat":"Mind","id":"mindful","min":10,"name":"Mindfulness","pts":2,"tpw":7,"type":"Minutes"},
    {"cat":"Mind","id":"memory","min":15,"name":"Memory / Focus Training","pts":2,"tpw":7,"type":"Minutes"},
    BEHAVIOR,
    {"cat":"Health","id":"exercise","min":null,"name":"Exercise / Walk 40 min","pts":2,"tpw":7,"type":"Check"}]};
  const SEED_VERSION = 5;
  const TYPES = ["np", "poker", "off"];
  const dayTypeOf = d => d && d.off ? "off" : d && d.type === "poker" ? "poker" : "np";
  const habitDaysOf = h => h.days ? { np: !!h.days.np, poker: !!h.days.poker, off: !!h.days.off } : { np: h.on !== "poker", poker: h.on !== "np", off: false };
  const fresh = ls.get("config/main") === undefined;
  if (fresh) ls.set("config/main", SEED);
  const v = fresh ? 2 : (ls.get("meta/seed") || 1);
  if (v < 2) {
    // Phones that opened the first version: add Playing Poker and Behavior Training once, without touching anything else.
    const c = ls.get("config/main");
    if (c && Array.isArray(c.habits)) {
      if (!c.habits.some(h => h && h.id === PLAY_POKER.id)) c.habits.unshift(PLAY_POKER);
      if (!c.habits.some(h => h && h.id === BEHAVIOR.id)) { const i = c.habits.findIndex(h => h && h.id === "memory"); c.habits.splice(i >= 0 ? i + 1 : c.habits.length, 0, BEHAVIOR); }
      ls.set("config/main", c);
    }
  }
  if (v < 3) {
    // A day is one type, and each type now keeps its own habits. Split every habit that was shared between types
    // into one copy per type (the first keeps its id, the others get "<id>-<type>"), then move each logged day's
    // marks onto the copy for that day's type, so past scores stay the same.
    const c = ls.get("config/main");
    if (c && Array.isArray(c.habits)) {
      if (!fresh) ls.set("meta/config-before-split", c);
      const ids = new Set(c.habits.map(h => h && h.id)), out = { np: [], poker: [], off: [] }, moved = {};
      for (const h of c.habits) {
        if (!h) continue;
        const d = habitDaysOf(h);
        TYPES.filter(t => d[t]).forEach((t, i) => {
          let id = h.id;
          if (i) { id = `${h.id}-${t}`; for (let n = 2; ids.has(id); n++) id = `${h.id}-${t}${n}`; ids.add(id); (moved[h.id] = moved[h.id] || {})[t] = id; }
          const cp = JSON.parse(JSON.stringify(h)); delete cp.on; cp.id = id; cp.days = { np: t === "np", poker: t === "poker", off: t === "off" };
          out[t].push(cp);
        });
      }
      c.habits = [...out.np, ...out.poker, ...out.off];
      ls.set("config/main", c);
      const byId = new Map(c.habits.map(h => [h.id, h]));
      for (const k of ls.keys()) {
        if (!/^days\/\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        const day = ls.get(k); if (!day || !day.h || typeof day.h !== "object") continue;
        const t = dayTypeOf(day); let changed = false;
        for (const id of Object.keys(day.h)) {
          const own = byId.get(id); if (own && own.days[t]) continue;
          const to = (moved[id] && moved[id][t]) || `${id}-${t}`, h2 = byId.get(to);
          if (h2 && h2.days[t] && !(to in day.h)) { day.h[to] = day.h[id]; delete day.h[id]; changed = true; }
        }
        if (changed) ls.set(k, day);
      }
    }
  }
  if (v < 4) {
    // "No tilt / no chasing losses" was taken off every list at the owner's request. Matched by name, so one that was
    // renamed into something else stays. The removed entries are kept in meta/removed, and day logs are not touched.
    const c = ls.get("config/main"), gone = h => !!h && String(h.name || "").trim().toLowerCase() === "no tilt / no chasing losses";
    if (c && Array.isArray(c.habits) && c.habits.some(gone)) {
      ls.set("meta/removed", [...(ls.get("meta/removed") || []), ...c.habits.filter(gone)]);
      c.habits = c.habits.filter(h => !gone(h));
      ls.set("config/main", c);
    }
  }
  if (v < 5) {
    // "1hr Study / Drill / Practice online" became "Study Drills or Online Play", scored by the hour, at the owner's
    // request. Matched by name in every list, ignoring case, spaces and punctuation. A tick on a logged day becomes 1 hour,
    // which earns the same 2 points. Ticks are converted before the list, so a run cut short can safely repeat. The old
    // entries are kept in meta/changed.
    const c = ls.get("config/main"), plain = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const mine = c && Array.isArray(c.habits) ? c.habits.filter(h => h && plain(h.name) === "1hrstudydrillpracticeonline") : [];
    if (mine.length) {
      const ticked = mine.filter(h => h.type === "Check");
      for (const k of ls.keys()) {
        if (!/^days\/\d{4}-\d{2}-\d{2}$/.test(k)) continue;
        const day = ls.get(k); if (!day || !day.h || typeof day.h !== "object") continue;
        const hit = ticked.filter(h => day.h[h.id] === true);
        if (hit.length) { hit.forEach(h => { day.h[h.id] = 1; }); ls.set(k, day); }
      }
      ls.set("meta/changed", [...(ls.get("meta/changed") || []), ...mine]);
      for (const h of mine) { h.name = STUDY.name; if (ticked.includes(h)) { h.type = "Hours"; h.pts = STUDY.pts; h.max = STUDY.max; h.min = null; } }
      ls.set("config/main", c);
    }
  }
  if (ls.get("meta/seed") !== SEED_VERSION) ls.set("meta/seed", SEED_VERSION);

  const docL = new Map(), colL = new Map();
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = p => { const v = ls.get(p); return { id: p.split("/").pop(), exists: v !== undefined, data: () => v, metadata: meta }; };
  const colDocs = c => ls.keys().filter(k => k.startsWith(c + "/") && k.split("/").length === c.split("/").length + 1).map(snapDoc);
  const colSnap = (c, changes) => { const docs = colDocs(c); return { docs, size: docs.length, empty: !docs.length, metadata: meta, docChanges: () => changes || docs.map(d => ({ type: "added", doc: d })) }; };
  const emit = (p, type) => {
    (docL.get(p) || []).forEach(f => f(snapDoc(p)));
    const c = p.split("/").slice(0, -1).join("/");
    (colL.get(c) || []).forEach(f => f(colSnap(c, [{ type, doc: snapDoc(p) }])));
  };
  const db = {
    doc: p => ({ id: p.split("/").pop(), path: p,
      get: async () => snapDoc(p),
      set: async d => { const had = ls.get(p) !== undefined; try { ls.set(p, JSON.parse(JSON.stringify(d))); } catch (e) { const err = new Error("Storage full"); err.code = "quota_exceeded"; throw err; } emit(p, had ? "modified" : "added"); },
      delete: async () => { ls.del(p); emit(p, "removed"); },
      onSnapshot: (n) => { docL.set(p, [...(docL.get(p) || []), n]); setTimeout(() => n(snapDoc(p)), 0); return () => docL.set(p, (docL.get(p) || []).filter(f => f !== n)); } }),
    collection: c => ({ path: c,
      onSnapshot: (n) => { colL.set(c, [...(colL.get(c) || []), n]); setTimeout(() => n(colSnap(c)), 0); return () => colL.set(c, (colL.get(c) || []).filter(f => f !== n)); } })
  };
  const saveFile = (filename, data, type) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const downloads = { save: async ({ filename, data }) => { saveFile(filename, data, filename.endsWith(".csv") ? "text/csv" : "application/json"); return { status: "saved" }; } };
  const user = { isOwner: async () => true, canEdit: async () => true };
  window.claude = { use: async n => n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : null };

  // Backup / restore of everything this app has stored on the phone.
  window.__htBackup = () => {
    const all = {}; for (const k of ls.keys()) all[k] = ls.get(k);
    const stamp = new Date().toISOString().slice(0, 10);
    saveFile(`habit-tracker-backup-${stamp}.json`, JSON.stringify({ app: "habit-tracker", version: 1, saved: new Date().toISOString(), data: all }), "application/json");
  };
  window.__htRestore = file => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read"));
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || j.app !== "habit-tracker" || typeof j.data !== "object") throw new Error("format");
        for (const k of ls.keys()) ls.del(k);
        for (const [k, v] of Object.entries(j.data)) if (/^(config\/main|meta\/seed|days\/\d{4}-\d{2}-\d{2})$/.test(k)) ls.set(k, v);
        resolve(Object.keys(j.data).length);
      } catch (e) { reject(e); }
    };
    r.readAsText(file);
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
