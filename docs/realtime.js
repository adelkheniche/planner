/* docs/realtime.js
   Plug & play realtime pour votre planner statique (GitHub Pages + Supabase).
   - Requiert la table public.blocks (SQL fourni précédemment) + publication supabase_realtime.
   - Aucune auth: usage clé anon.
   - Expose une API globale window.RT pour brancher votre UI.
*/

(() => {
  // ─────────────────────────────────────────────────────────────────────────────
  //  CONFIG À RENSEIGNER
  // ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  url: "https://kadoikpkjmkchabvnuqs.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG9pa3Bram1rY2hhYnZudXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMzEwNDIsImV4cCI6MjA3MDkwNzA0Mn0.q28StZ8nsrbck2Xx6xBCfpgdfLotxne3cyWc6-o_FZM",
  room: "planner_room_main",
  schema: "public",
  table: "blocks"
};

  // ─────────────────────────────────────────────────────────────────────────────
  //  OUTILS
  // ─────────────────────────────────────────────────────────────────────────────
  const uuid = () =>
    ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c/4).toString(16)
    );

  const throttle = (fn, ms=50) => {
    let last = 0, pending;
    return (...args) => {
      const now = Date.now();
      const run = () => { last = now; fn(...args); };
      if (now - last >= ms) run();
      else {
        clearTimeout(pending);
        pending = setTimeout(run, ms - (now - last));
      }
    };
  };

  // Hooks UI optionnels: si votre app expose window.App, on s’y branche, sinon no-op
  const hooks = {
    onDbChange: (type, row, oldRow) => {
      if (window.App && typeof window.App.onDbChange === "function") {
        window.App.onDbChange(type, row, oldRow);
      }
    },
    onPresence: (list) => {
      if (window.App && typeof window.App.onPresence === "function") {
        window.App.onPresence(list);
      } else {
        // Affiche une liste simple des pseudos connectés
        let box = document.getElementById("rt-presence");
        if (!box) {
          box = document.createElement("div");
          box.id = "rt-presence";
          box.style.position = "fixed";
          box.style.top = "8px";
          box.style.right = "8px";
          box.style.display = "flex";
          box.style.gap = "4px";
          box.style.flexWrap = "wrap";
          box.style.zIndex = "2147483647"; // au-dessus de tout
          document.body.appendChild(box);
        }
        box.innerHTML = "";
        list.forEach(p => {
          const span = document.createElement("span");
          span.textContent = p.pseudo;
          span.style.border = `1px solid ${p.color}`;
          span.style.color = p.color;
          span.style.padding = "2px 6px";
          span.style.borderRadius = "9999px";
          span.style.fontSize = "12px";
          box.appendChild(span);
        });
      }
    },
    onLiveDrag: (msg) => {
      if (window.App && typeof window.App.onLiveDrag === "function") {
        window.App.onLiveDrag(msg);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  CLIENT SUPABASE
  // ─────────────────────────────────────────────────────────────────────────────
  if (!window.supabase) {
    console.error("[RT] Supabase JS v2 non chargé (CDN).");
    return;
  }
  const sb = window.supabase.createClient(CFG.url, CFG.anonKey);

  // Identité “anonyme” locale (mémoire navigateur)
  const PALETTE = ["#2563eb","#16a34a","#ea580c","#9333ea","#0ea5e9","#ef4444","#22c55e","#f59e0b","#64748b","#d946ef","#14b8a6","#a16207"];
  const NAMES = ["Arthur","Lancelot","Perceval","Karadoc","Bohort","Léodagan","Séli","Guenièvre","Merlin","Mevanwi","Yvain","Gauvain"];
  const ID_KEY = "planner_identity_v2";
  let identity = null;
  try {
    identity = JSON.parse(localStorage.getItem(ID_KEY) || "null");
  } catch {}
  if (!identity) {
    const pseudo = NAMES[Math.floor(Math.random() * NAMES.length)];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    identity = { id: uuid(), pseudo, color };
    localStorage.setItem(ID_KEY, JSON.stringify(identity));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  CANAL TEMPS RÉEL (Presence + Broadcast)
  // ─────────────────────────────────────────────────────────────────────────────
  const channel = sb.channel(CFG.room, {
    config: {
      presence: { key: identity.id }
    }
  });

  channel
    // Liste des personnes connectées (sync)
    .on("presence", { event: "sync" }, () => {
      // presenceState() => { key: [states...] }
      const state = channel.presenceState();
      const flat = [];
      for (const [id, arr] of Object.entries(state)) {
        // on garde la dernière version
        const st = arr[arr.length - 1];
        if (st) flat.push({ id, pseudo: st.pseudo, color: st.color });
      }
      hooks.onPresence(flat);
    })
    // Drag en direct (messages éphémères)
    .on("broadcast", { event: "drag" }, (payload) => {
      const msg = payload.payload;  // { t, blockId, pos, by, color }
      hooks.onLiveDrag(msg);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Publie notre état (pseudo/couleur)
        await channel.track({ pseudo: identity.pseudo, color: identity.color });
      }
    });

  // ─────────────────────────────────────────────────────────────────────────────
  //  CHANGEMENTS BDD (INSERT/UPDATE/DELETE)
  // ─────────────────────────────────────────────────────────────────────────────
  const dbChannel = sb.channel("db-" + CFG.room)
    .on(
      "postgres_changes",
      { event: "*", schema: CFG.schema, table: CFG.table },
      (payload) => {
        const { eventType, new: row, old: oldRow } = payload;
        hooks.onDbChange(eventType, row, oldRow);
      }
    )
    .subscribe();

  // ─────────────────────────────────────────────────────────────────────────────
  //  API PUBLIQUE (à utiliser dans votre UI)
  // ─────────────────────────────────────────────────────────────────────────────
  const API = {
    // Récupération initiale
    async fetchAll(where = {}) {
      let query = sb.from(CFG.table).select("*").order("day", { ascending: true }).order("starts_at", { ascending: true });
      // Filtres simples { day, lane, ... } si vous voulez
      Object.entries(where).forEach(([k, v]) => { query = query.eq(k, v); });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    // CRUD
    async createBlock(block) {
      const row = { ...block, last_modified_by: identity.pseudo };
      const { data, error } = await sb.from(CFG.table).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async updateBlock(id, patch) {
      const { data, error } = await sb.from(CFG.table)
        .update({ ...patch, last_modified_by: identity.pseudo })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async deleteBlock(id) {
      const { error } = await sb.from(CFG.table).delete().eq("id", id);
      if (error) throw error;
      return true;
    },

    // Drag “live” (sans écrire en BDD tant que non lâché)
    startDrag(blockId) {
      channel.send({ type: "broadcast", event: "drag", payload: {
        t: "start", blockId, by: identity.pseudo, color: identity.color
      }});
    },

    moveDrag: throttle((blockId, pos /* ex: {x,y} ou {day, starts_at} */) => {
      channel.send({ type: "broadcast", event: "drag", payload: {
        t: "move", blockId, pos, by: identity.pseudo, color: identity.color
      }});
    }, 40),

    async endDrag(blockId, finalPatch /* ex: { day, starts_at, duration, lane } */) {
      channel.send({ type: "broadcast", event: "drag", payload: {
        t: "end", blockId, by: identity.pseudo, color: identity.color
      }});
      // Écrit l’état final en BDD → tous recevront l’UPDATE via postgres_changes
      return API.updateBlock(blockId, finalPatch);
    },

    // Accès identité locale (pour votre UI)
    getIdentity() { return { ...identity }; },

    // Permet de changer pseudo/couleur à chaud
    async setIdentity({ pseudo, color }) {
      if (pseudo) identity.pseudo = pseudo;
      if (color)  identity.color  = color;
      localStorage.setItem(ID_KEY, JSON.stringify(identity));
      // republie l’état presence
      await channel.track({ pseudo: identity.pseudo, color: identity.color });
    }
  };

  // Expose global
  window.RT = API;
})();
