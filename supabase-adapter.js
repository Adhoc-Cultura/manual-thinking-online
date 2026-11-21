/* Manual Thinking en línia: adaptador de Supabase
 *
 * Ofereix a l'eina la mateixa interfície que les capacitats de la plataforma de Claude
 * (db, user, room, sample, assets, downloads) fent servir Supabase:
 *   db        -> taula public.docs amb temps real
 *   user      -> sessió anònima de Supabase Auth
 *   room      -> Realtime Presence (persones connectades)
 *   sample    -> funció de servidor "ia" (API d'Anthropic)
 *   assets    -> Storage, bucket "fotos"
 *   downloads -> descàrrega estàndard del navegador
 *
 * Necessita que abans s'hagin carregat supabase-js i config.js.
 */
(function () {
  "use strict";

  const cfg = window.MT_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) return;
  if (/EL-VOSTRE-PROJECTE|ENGANXEU-AQUI/.test(cfg.supabaseUrl + cfg.supabaseKey)) {
    console.warn("Manual Thinking: cal posar la URL i la clau del projecte a config.js");
    return;
  }

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "mt-supabase-auth" }
  });

  /* ---------- Sessió anònima ---------- */
  let uid = null;
  const ready = (async () => {
    let { data } = await sb.auth.getSession();
    let session = data && data.session;
    if (!session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) throw r.error;
      session = r.data.session;
    }
    uid = session.user.id;
    return uid;
  })();

  /* ---------- Utilitats ---------- */
  const fail = (code, message) => ({ code, message: message || code });
  function mapErr(e) {
    if (!e) return fail("unavailable");
    if (["invalid_argument", "rate_limited", "unavailable", "upstream_error", "not_configured"].includes(e.code)) return e;
    if (e.code === "42501" || /row-level security|permission denied/i.test(e.message || "")) return fail("invalid_argument", "Sense permís per desar");
    if (e.code === "P0002") return fail("invalid_argument", "El document no existeix");
    return fail("unavailable", e.message || String(e));
  }
  function newId() {
    const a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let s = "";
    for (const x of crypto.getRandomValues(new Uint8Array(20))) s += a[x % a.length];
    return s;
  }
  function splitDoc(path) {
    const p = String(path).split("/");
    if (p.length !== 2 || !p[0] || !p[1]) throw new TypeError("Ruta de document no admesa: " + path);
    return p;
  }
  const rowSid = (c, id, data) => (c === "sessions" ? id : (data && typeof data.sid === "string" ? data.sid : null));
  const docSnap = (id, data) => ({
    id,
    exists: data != null,
    data: () => (data == null ? undefined : data),
    metadata: { fromCache: false, hasPendingWrites: false }
  });

  /* ---------- Escoltadors en temps real ---------- */
  const listeners = new Set();
  function broadcast(type, row) { for (const l of listeners) l.handle(type, row); }
  let channelCount = 0;

  function makeListener(spec, next, onError) {
    const { collection, id, filters = [], order = null, limit = null, single = false } = spec;
    const rows = new Map();
    let loaded = false, scheduled = false, closed = false, channel = null;

    const matches = row =>
      row.collection === collection &&
      (single ? row.id === id : filters.every(([f, v]) => (f === "sid" ? row.sid === v : row.data && row.data[f] === v)));

    function emit() {
      if (scheduled || closed || !loaded) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (closed) return;
        if (single) { next(docSnap(id, rows.has(id) ? rows.get(id) : null)); return; }
        let list = [...rows.entries()].map(([k, d]) => ({ id: k, d }));
        if (order) {
          const [f, dir] = order;
          list.sort((a, b) => {
            const x = a.d && a.d[f], y = b.d && b.d[f];
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            const r = x < y ? -1 : x > y ? 1 : 0;
            return dir === "desc" ? -r : r;
          });
        } else {
          list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        }
        if (limit) list = list.slice(0, limit);
        const docs = list.map(x => docSnap(x.id, x.d));
        next({ docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] });
      });
    }

    const L = {
      handle(type, row) {
        if (!row || row.collection !== collection) return;
        if (type === "DELETE") { if (rows.delete(row.id)) emit(); return; }
        if (matches(row)) { rows.set(row.id, row.data); emit(); }
        else if (rows.delete(row.id)) emit();
      }
    };

    async function load() {
      let q = sb.from("docs").select("collection,id,sid,data").eq("collection", collection);
      if (single) q = q.eq("id", id);
      else for (const [f, v] of filters) q = f === "sid" ? q.eq("sid", v) : q.eq("data->>" + f, String(v));
      const { data, error } = await q;
      if (error) throw error;
      if (closed) return;
      rows.clear();
      for (const r of data || []) rows.set(r.id, r.data);
      loaded = true;
      emit();
    }

    const sidFilter = filters.find(f => f[0] === "sid");
    const filter = single ? "id=eq." + id : sidFilter ? "sid=eq." + sidFilter[1] : "collection=eq." + collection;

    (async () => {
      try {
        await ready;
        if (closed) return;
        let first = true;
        channel = sb
          .channel("mt-" + (++channelCount) + "-" + newId().slice(0, 6))
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "docs", filter }, p => L.handle("UPSERT", p.new))
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "docs", filter }, p => L.handle("UPSERT", p.new))
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "docs" }, p => L.handle("DELETE", p.old))
          .subscribe(status => {
            // en cada reconnexió es torna a llegir tot per no perdre canvis
            if (status === "SUBSCRIBED" && !first) load().catch(() => {});
            first = false;
          });
        await load();
      } catch (e) {
        if (!closed && onError) onError(mapErr(e));
      }
    })();

    listeners.add(L);
    return () => {
      closed = true;
      listeners.delete(L);
      if (channel) sb.removeChannel(channel);
    };
  }

  // Quan la pestanya torna a estar visible (mòbils que han estat en repòs), es reprèn la connexió
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sb.realtime && sb.realtime.connect && sb.realtime.connect();
  });

  /* ---------- db ---------- */
  function docRef(path) {
    const [c, id] = splitDoc(path);
    return {
      id,
      path: c + "/" + id,
      async get() {
        await ready;
        const { data, error } = await sb.from("docs").select("data").eq("collection", c).eq("id", id).maybeSingle();
        if (error) throw mapErr(error);
        return docSnap(id, data ? data.data : null);
      },
      async set(d) {
        await ready;
        const row = { collection: c, id, sid: rowSid(c, id, d), data: d };
        const { error } = await sb.from("docs").upsert(row, { onConflict: "collection,id" });
        if (error) throw mapErr(error);
        broadcast("UPSERT", row);
      },
      async update(patch) {
        await ready;
        const { data, error } = await sb.rpc("docs_update", { p_collection: c, p_id: id, p_patch: patch });
        if (error) throw mapErr(error);
        broadcast("UPSERT", { collection: c, id, sid: rowSid(c, id, data), data });
      },
      async delete() {
        await ready;
        const { error } = await sb.from("docs").delete().eq("collection", c).eq("id", id);
        if (error) throw mapErr(error);
        broadcast("DELETE", { collection: c, id });
      },
      onSnapshot(next, onError) {
        return makeListener({ collection: c, id, single: true }, next, onError);
      }
    };
  }

  function query(c, filters, order, limit) {
    return {
      where(f, op, v) {
        if (op !== "==") throw new TypeError("Aquest adaptador només admet l'operador ==");
        return query(c, filters.concat([[f, v]]), order, limit);
      },
      orderBy(f, dir) { return query(c, filters, [f, dir || "asc"], limit); },
      limit(n) { return query(c, filters, order, n); },
      get() {
        return new Promise((resolve, reject) => {
          const un = makeListener({ collection: c, filters, order, limit }, snap => { un(); resolve(snap); }, e => { un(); reject(e); });
        });
      },
      onSnapshot(next, onError) {
        return makeListener({ collection: c, filters, order, limit }, next, onError);
      }
    };
  }

  function collRef(path) {
    const c = String(path);
    if (!c || c.includes("/")) throw new TypeError("Ruta de col·lecció no admesa: " + path);
    const q = query(c, [], null, null);
    q.path = c;
    q.doc = id => docRef(c + "/" + (id || newId()));
    q.add = async d => { const r = docRef(c + "/" + newId()); await r.set(d); return r; };
    return q;
  }

  const db = { doc: docRef, collection: collRef };

  /* ---------- user ---------- */
  const profile = i => ({ id: i, name: "", avatarUrl: "", color: "#121212", email: null, isMe: i === uid, guest: false });
  const userNs = {
    async me() { await ready; return { id: uid, name: "", avatarUrl: "", color: "#121212", email: null, isOwner: false, canEdit: true }; },
    async id() { await ready; return uid; },
    async isOwner() { return false; },
    async canEdit() { return true; },
    async can() { return true; },
    async profiles(ids) { const o = {}; for (const i of [].concat(ids || [])) o[i] = profile(i); return o; },
    async search() { return []; },
    async name() { return ""; },
    async avatarUrl() { return null; },
    async email() { return null; }
  };

  /* ---------- room (persones connectades) ---------- */
  function makeRoom() {
    const state = {};
    const handlers = new Set();
    let peers = [], ch = null, subscribed = false;
    const key = (uid || "anon") + "-" + newId().slice(0, 6);
    const fire = () => { for (const h of handlers) { try { h({ peers, joined: [], left: [], updated: [] }); } catch (e) {} } };

    ch = sb.channel("mt-presencia", { config: { presence: { key } } });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState();
      peers = Object.entries(st).map(([k, metas]) => {
        const m = Object.assign({}, metas[metas.length - 1]);
        delete m.presence_ref;
        return { peer: k, by: null, isMe: k === key, sameTab: k === key, kind: "viewer", guest: false, presence: m, updatedAt: Date.now() };
      });
      fire();
    }).subscribe(async status => {
      subscribed = status === "SUBSCRIBED";
      if (subscribed) { try { await ch.track(state); } catch (e) {} }
    });

    return {
      onPeers(fn) { handlers.add(fn); setTimeout(() => fn({ peers, joined: [], left: [], updated: [] }), 0); return () => handlers.delete(fn); },
      async presence(patch) {
        for (const [k, v] of Object.entries(patch || {})) { if (v === null) delete state[k]; else state[k] = v; }
        if (subscribed) await ch.track(state);
      },
      peers() { return peers; },
      connected() { return subscribed; },
      on() { return () => {}; },
      async emit() {}
    };
  }
  let roomNs = null;

  /* ---------- Imatges ---------- */
  async function toJpeg(blob, max) {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * s);
    cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.85);
  }

  /* ---------- sample (IA) ---------- */
  async function callIa(body) {
    await ready;
    const { data, error } = await sb.functions.invoke("ia", { body });
    if (error) {
      let code = "upstream_error", msg = error.message;
      try {
        const res = error.context;
        if (res && res.status === 429) code = "rate_limited";
        const j = res && typeof res.json === "function" ? await res.json() : null;
        if (j) { msg = j.error || msg; if (j.code) code = j.code; }
      } catch (e) {}
      throw fail(code, msg);
    }
    return data;
  }
  const sample = async function (input, opts) {
    opts = opts || {};
    const prompt = typeof input === "string" ? input : Array.isArray(input) ? input.map(m => m.content).join("\n\n") : String(input);
    let body = { mode: "sintesi", prompt };
    if (opts.images && opts.images.length) {
      let dataUrl;
      try { dataUrl = await toJpeg(opts.images[0], 2000); }
      catch (e) { throw fail("invalid_argument", "No s'ha pogut llegir la imatge. Proveu amb una foto JPG o PNG."); }
      body = { mode: "transcripcio", prompt, image: { media_type: "image/jpeg", data: dataUrl.split(",")[1] } };
    }
    const d = await callIa(body);
    return { text: (d && d.text) || "", truncated: false };
  };
  sample.json = async (input, opts) => {
    const r = await sample(input, opts);
    const m = String(r.text || "").match(/\{[\s\S]*\}/);
    if (!m) throw fail("upstream_error", "La resposta de la IA no és JSON");
    return JSON.parse(m[0]);
  };
  sample.limits = async () => ({ images: true });

  /* ---------- assets (fotos) ---------- */
  const assetsNs = {
    async upload(file) {
      await ready;
      let blob = file, ext = ((file.type || "").split("/")[1] || "jpg").replace("jpeg", "jpg");
      // les fotos grans o en formats poc compatibles (HEIC) es converteixen a JPEG
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3000000) {
        try { blob = await (await fetch(await toJpeg(file, 2400))).blob(); ext = "jpg"; } catch (e) {}
      }
      const path = uid + "/" + Date.now() + "-" + newId().slice(0, 6) + "." + ext;
      const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: blob.type || file.type || "image/jpeg", upsert: false });
      if (error) throw fail("unavailable", error.message);
      const url = sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
      return { id: path, url, sizeBytes: blob.size, contentType: blob.type };
    },
    async delete(id) { await ready; await sb.storage.from("fotos").remove([id]); },
    async list() { return { assets: [], usage: {} }; }
  };

  /* ---------- downloads ---------- */
  const downloadsNs = {
    async save({ filename, data }) {
      const type = /\.html?$/.test(filename) ? "text/html;charset=utf-8" : /\.md$/.test(filename) ? "text/markdown;charset=utf-8" : "application/octet-stream";
      const blob = data instanceof Blob ? data : new Blob([data], { type });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return { status: "saved" };
    }
  };

  /* ---------- Punt d'entrada ---------- */
  window.MT_BACKEND = {
    kind: "supabase",
    async use(name) {
      if (name === "downloads") return downloadsNs;
      try { await ready; }
      catch (e) { console.error("Manual Thinking: no s'ha pogut iniciar la sessió anònima.", e); return null; }
      switch (name) {
        case "db": return db;
        case "user": return userNs;
        case "room": return roomNs || (roomNs = makeRoom());
        case "sample": return sample;
        case "assets": return assetsNs;
      }
      return null;
    }
  };
})();
