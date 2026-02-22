/* docs/realtime.js
   Realtime pour planner statique (Yjs + providers).
   - État persistant partagé via Y.Map ("planner_state").
   - Presence + événements éphémères via awareness.
   - Expose une API globale window.RT pour brancher une UI non-React.
*/

(() => {
  const DEFAULT_IDENTITY = {
    PALETTE: [
      "#451968","#5E2A7A","#782F3E","#8F4553","#430942",
      "#320731","#BAB4B8","#D9D3D8","#6A4A68","#9A6F92",
      "#200319","#362138"
    ],
    NAMES: [
      "Arthur","Lancelot","Perceval","Karadoc","Bohort",
      "Léodagan","Séli","Guenièvre","Merlin","Mevanwi",
      "Yvain","Gauvain"
    ],
    ID_KEY: "planner_identity_v2",
  };
  const { PALETTE, NAMES, ID_KEY } = window.Identity || DEFAULT_IDENTITY;

  const q = new URLSearchParams(location.search);
  const CFG = {
    room: "planner_room_main",
    mode: (q.get("rt") || localStorage.getItem("planner_rt_mode") || "webrtc").toLowerCase(),
    signaling: (q.get("signaling") || localStorage.getItem("planner_signaling_url") || "wss://signaling.yjs.dev")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean),
    websocketEndpoint: q.get("ws") || localStorage.getItem("planner_ws_endpoint") || "",
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  };

  const hooks = {
    onState: (state) => {
      if (window.App && typeof window.App.onSharedState === "function") {
        window.App.onSharedState(state);
      }
    },
    onPresence: (list) => {
      if (window.App && typeof window.App.onPresence === "function") {
        window.App.onPresence(list);
      }
    },
    onLiveDrag: (msg) => {
      if (window.App && typeof window.App.onLiveDrag === "function") {
        window.App.onLiveDrag(msg);
      }
    }
  };

  if (!window.Y || (!window.WebrtcProvider && !window.WebsocketProvider)) {
    console.error("[RT] Yjs/providers non chargés.");
    return;
  }

  let identity = null;
  try { identity = JSON.parse(localStorage.getItem(ID_KEY) || "null"); } catch {}
  if (!identity) {
    const pseudo = NAMES[Math.floor(Math.random() * NAMES.length)];
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const id = crypto?.randomUUID?.() || String(Date.now());
    identity = { id, pseudo, color };
    localStorage.setItem(ID_KEY, JSON.stringify(identity));
  }

  const ydoc = new window.Y.Doc();
  let provider = null;

  if (CFG.mode === "websocket") {
    if (!window.WebsocketProvider || !CFG.websocketEndpoint) {
      console.error("[RT] Mode websocket choisi mais endpoint/ws provider manquant.");
      return;
    }
    provider = new window.WebsocketProvider(CFG.websocketEndpoint, CFG.room, ydoc, { connect: true });
  } else {
    if (!window.WebrtcProvider) {
      console.error("[RT] WebrtcProvider indisponible.");
      return;
    }
    provider = new window.WebrtcProvider(CFG.room, ydoc, {
      signaling: CFG.signaling,
      peerOpts: { config: { iceServers: CFG.iceServers } }
    });
  }

  const stateMap = ydoc.getMap("planner_state");

  const emitState = () => hooks.onState({
    blocks: stateMap.get("blocks") || []
  });
  stateMap.observe(emitState);

  const awareness = provider.awareness;
  awareness.setLocalStateField("user", identity);
  const onAwareness = () => {
    const states = Array.from(awareness.getStates().values());
    hooks.onPresence(states.filter(s => s.user).map(s => s.user));
    states.forEach((s) => { if (s.dragEvent && s.dragEvent.from !== identity.id) hooks.onLiveDrag(s.dragEvent); });
  };
  awareness.on("change", onAwareness);

  window.RT = {
    getIdentity() { return { ...identity }; },
    fetchAll() { return stateMap.get("blocks") || []; },
    setAll(blocks = []) { stateMap.set("blocks", blocks); },
    createBlock(block) {
      const next = [...(stateMap.get("blocks") || []), block];
      stateMap.set("blocks", next);
      return block;
    },
    updateBlock(id, patch) {
      const next = (stateMap.get("blocks") || []).map(b => b.id === id ? { ...b, ...patch } : b);
      stateMap.set("blocks", next);
      return next.find(b => b.id === id) || null;
    },
    deleteBlock(id) {
      stateMap.set("blocks", (stateMap.get("blocks") || []).filter(b => b.id !== id));
      return true;
    },
    startDrag(blockId) {
      awareness.setLocalStateField("dragEvent", { t: "start", blockId, from: identity.id, color: identity.color });
    },
    moveDrag(blockId, pos) {
      awareness.setLocalStateField("dragEvent", { t: "move", blockId, pos, from: identity.id, color: identity.color });
    },
    endDrag(blockId) {
      awareness.setLocalStateField("dragEvent", { t: "end", blockId, from: identity.id, color: identity.color });
      awareness.setLocalStateField("dragEvent", null);
    }
  };
})();
