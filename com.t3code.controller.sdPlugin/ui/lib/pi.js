// Minimal Stream Deck / OpenDeck property-inspector bridge. The host calls
// connectElgatoStreamDeckSocket(...); we register, pull this key's settings and
// the plugin-wide global settings, and expose a tiny T3PI the page binds to.

(function () {
  let ws;
  let ctx;
  let action = "";
  let settings = {};
  let global = {};
  const readyCbs = [];

  function fire() {
    for (const cb of readyCbs) {
      try { cb(); } catch (e) { console.error(e); }
    }
  }

  window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent, _info, actionInfo) {
    ctx = uuid;
    try {
      const ai = JSON.parse(actionInfo || "{}");
      action = ai.action || "";
      settings = (ai.payload && ai.payload.settings) || {};
    } catch (_) { /* no seed settings */ }

    ws = new WebSocket("ws://127.0.0.1:" + port);
    ws.onopen = function () {
      ws.send(JSON.stringify({ event: registerEvent, uuid: uuid }));
      ws.send(JSON.stringify({ event: "getGlobalSettings", context: uuid }));
      ws.send(JSON.stringify({ event: "getSettings", context: uuid }));
    };
    ws.onmessage = function (e) {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }
      if (msg.event === "didReceiveGlobalSettings") {
        global = (msg.payload && msg.payload.settings) || {};
        fire();
      } else if (msg.event === "didReceiveSettings") {
        settings = (msg.payload && msg.payload.settings) || {};
        fire();
      }
    };
  };

  window.T3PI = {
    onReady: function (cb) { readyCbs.push(cb); },
    action: function () { return action; },
    settings: function () { return settings; },
    global: function () { return global; },
    setSettings: function (patch) {
      settings = Object.assign({}, settings, patch);
      ws && ws.send(JSON.stringify({ event: "setSettings", context: ctx, payload: settings }));
    },
    setGlobal: function (patch) {
      global = Object.assign({}, global, patch);
      ws && ws.send(JSON.stringify({ event: "setGlobalSettings", context: ctx, payload: global }));
    },
  };
})();
