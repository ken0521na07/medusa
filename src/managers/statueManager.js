import GameObject from "../entities/gameObject.js";
import { MAPS, STATUE_DISPLAY, TILE, TILE_SIZE } from "../core/constants.js";
import * as mapService from "./mapService.js";
import * as snakeManager from "./snakeManager.js";
import { showCustomAlert } from "../ui/modals.js";
import { on, off, emit } from "../core/eventBus.js";

let statues = [];
let _appLayers = null;
let _floorListener = null;

function _ensureSpritesMatchMap() {
  // Ensure each statue GameObject reflects the current model (x,y,floor)
  try {
    for (const s of statues) {
      if (!s) continue;
      try {
        if (s.obj) {
          // keep grid coords in sync
          s.obj.gridX = typeof s.x === "number" ? s.x : s.obj.gridX;
          s.obj.gridY = typeof s.y === "number" ? s.y : s.obj.gridY;
          // update pixel position
          try {
            s.obj.updatePixelPosition();
          } catch (e) {}
          // visibility based on current floor
          try {
            s.obj.sprite.visible = s.floor === mapService.getFloor();
          } catch (e) {}
          // ensure sprite is attached to entity layer exactly once
          try {
            if (
              _appLayers &&
              _appLayers.entityLayer &&
              s.obj.sprite &&
              !s.obj.sprite.parent
            ) {
              _appLayers.entityLayer.addChild(s.obj.sprite);
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
}

// Helper: remove any statue model/sprite at a given coord (except optional excluded statue)
function _removeStatueAt(x, y, floor, excludeStatue) {
  try {
    for (const s of statues) {
      try {
        if (
          !s ||
          (excludeStatue && s === excludeStatue) ||
          s.x !== x ||
          s.y !== y ||
          s.floor !== floor
        )
          continue;
        // clear tile
        try {
          mapService.setTile(x, y, 0, floor);
        } catch (e) {}
        // remove sprite if present
        try {
          if (s.obj && s.obj.sprite) {
            if (
              s.obj.sprite.parent &&
              typeof s.obj.sprite.parent.removeChild === "function"
            ) {
              s.obj.sprite.parent.removeChild(s.obj.sprite);
            }
            try {
              s.obj.sprite.visible = false;
              // make non-interactive so it cannot receive A-button
              if (typeof s.obj.sprite.interactive !== "undefined")
                s.obj.sprite.interactive = false;
            } catch (e) {}
          }
        } catch (e) {}
        s.removed = true;
        s.obj = null;
      } catch (e) {}
    }
  } catch (e) {}
}

export async function init(appLayers) {
  _appLayers = appLayers;
  statues = [];
  try {
    for (const [floorKey, map] of Object.entries(MAPS)) {
      const floor = parseInt(floorKey, 10);
      for (let y = 0; y < map.length; y++) {
        const row = map[y] || [];
        for (let x = 0; x < row.length; x++) {
          const t = row[x];
          if (typeof t === "string" && t.startsWith("statue_")) {
            try {
              const g = new GameObject(x, y, "img/statue.png");
              g.sprite.visible = floor === mapService.getFloor();
              if (_appLayers && _appLayers.entityLayer)
                _appLayers.entityLayer.addChild(g.sprite);
              // record initial position so we can reset on player death by crush
              statues.push({
                x,
                y,
                floor,
                nameKey: t,
                obj: g,
                initialX: x,
                initialY: y,
                initialFloor: floor,
                // remember original texture path for reset
                originalTexturePath: "img/statue.png",
                // runtime flags
                moved: false,
                removed: false,
                broken: false,
              });
            } catch (e) {
              console.error("statueManager.init: failed to create statue", e);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("statueManager.init failed", e);
  }
  try {
    window.__statues = statues;
  } catch (e) {}

  // reconcile sprites with current map state (positions/visibility)
  try {
    _ensureSpritesMatchMap();
  } catch (e) {}

  // register floor change listener to keep sprites in sync when player teleports
  try {
    if (_floorListener) off("floorChanged", _floorListener);
  } catch (e) {}
  _floorListener = (f) => {
    try {
      _ensureSpritesMatchMap();
    } catch (e) {}
  };
  try {
    on("floorChanged", _floorListener);
    // immediately sync with current floor
    try {
      _floorListener(mapService.getFloor());
    } catch (e) {}
  } catch (e) {}

  // do not call _ensureSpritesMatchMap here; sprites are created from MAPS

  // Ensure default cushion mapping is always available (so ムーブ can use it
  // even if クッショ hasn't been cast). Existing entries on window.__cushionMap
  // are preserved and take precedence.
  try {
    const defaultCushion = {
      "1,0,6": { x: 0, y: 9, f: 5 },
      "9,0,6": { x: 0, y: 1, f: 5 },
      "5,1,5": { x: 9, y: 5, f: 3 },
      "10,4,5": { x: 4, y: 10, f: 4 },
      "7,0,4": { x: 7, y: 0, f: 3 },
      "6,10,4": { x: 6, y: 10, f: 3 },
      "9,5,4": { x: 9, y: 5, f: 3 },
      "3,2,2": { x: 8, y: 3, f: 0 },
    };
    window.__cushionMap = Object.assign(
      {},
      defaultCushion,
      window.__cushionMap || {}
    );
  } catch (e) {}

  return statues;
}

// Ensure the runtime map tiles and statue objects are in sync.
// (implementation is defined above; duplicate empty definition removed)

export function getStatues() {
  return statues;
}

export function syncVisibility(floor) {
  try {
    // reconcile in case runtime map changed (moves/falls)
    _ensureSpritesMatchMap();
  } catch (e) {}
  for (const s of statues) {
    try {
      if (s && s.obj) s.obj.sprite.visible = s.floor === floor;
    } catch (e) {}
  }
}

// shared helper to apply effects when a statue falls (texture swap, player death, snake kill, alerts)
function _applyFallenStatueEffects(st, destX, destY, destFloor) {
  try {
    // Prevent autosave while we manipulate map/statue state to avoid races
    try {
      if (typeof window !== "undefined") window.__skipSaving = true;
    } catch (e) {}

    // Track if we schedule a deferred restore (via triggerFall onClose). If so,
    // keep __skipSaving true until that onClose handler runs and clears it.
    let deferredRestoreScheduled = false;

    // If another statue already occupies the destination, remove its sprite/object
    try {
      const existing = statues.find(
        (s) =>
          s &&
          s !== st &&
          s.x === destX &&
          s.y === destY &&
          s.floor === destFloor
      );
      if (existing) {
        if (existing.obj && existing.obj.sprite) {
          try {
            if (
              existing.obj.sprite.parent &&
              typeof existing.obj.sprite.parent.removeChild === "function"
            ) {
              existing.obj.sprite.parent.removeChild(existing.obj.sprite);
            }
            existing.obj.sprite.visible = false;
          } catch (e) {}
        }
        existing.removed = true;
        existing.obj = null;
      }
    } catch (e) {}

    // If the player is standing on the destination where the statue would land,
    // restore the moved statue to its original position immediately and then
    // trigger the player's death modal. Do NOT place the broken statue at the
    // destination in this exceptional case.
    try {
      const p =
        typeof window !== "undefined" && window.__playerInstance
          ? window.__playerInstance
          : null;
      if (
        p &&
        p.gridX === destX &&
        p.gridY === destY &&
        p.floor === destFloor
      ) {
        // clear any tile at the destination
        try {
          mapService.setTile(destX, destY, 0, destFloor);
        } catch (e) {}
        // restore statue tile at its initial position
        try {
          mapService.setTile(
            st.initialX,
            st.initialY,
            st.nameKey,
            st.initialFloor
          );
        } catch (e) {}

        // update model and sprite (recreate if necessary)
        st.x = st.initialX;
        st.y = st.initialY;
        st.floor = st.initialFloor;
        try {
          if (st.obj) {
            st.obj.gridX = st.initialX;
            st.obj.gridY = st.initialY;
            try {
              const origTex = PIXI.Texture.from(
                st.originalTexturePath || "img/statue.png"
              );
              if (origTex) st.obj.sprite.texture = origTex;
            } catch (e) {}
            try {
              st.obj.sprite.visible = st.floor === mapService.getFloor();
            } catch (e) {}
            try {
              st.obj.updatePixelPosition();
            } catch (e) {}
          } else {
            try {
              const g = new GameObject(
                st.initialX,
                st.initialY,
                st.originalTexturePath || "img/statue.png"
              );
              g.sprite.visible = st.floor === mapService.getFloor();
              if (_appLayers && _appLayers.entityLayer)
                _appLayers.entityLayer.addChild(g.sprite);
              st.obj = g;
              try {
                st.obj.gridX = st.initialX;
                st.obj.gridY = st.initialY;
                st.obj.updatePixelPosition();
              } catch (e) {}
            } catch (e) {}
          }
        } catch (e) {}

        st.moved = false;
        st.broken = false;
        st.removed = false;

        // Notify that statue state changed so autosave can persist the restoration
        try {
          if (typeof emit === "function") {
            try {
              emit("statueChanged", { statue: st });
            } catch (e) {}
            try {
              emit("playerMoved", { reason: "statueRestored" });
            } catch (e) {}
            try {
              emit("floorChanged", st.floor);
            } catch (e) {}
          }
        } catch (e) {}

        // Do NOT clear skipSaving yet. Instead mark that a deferred restore/save
        // will be performed when the death modal closes so we don't persist any
        // intermediate state. The onClose handler below will clear __skipSaving
        // and re-emit events to trigger the autosave.
        try {
          deferredRestoreScheduled = true;
        } catch (e) {}
        try {
          // mark statue as pending restore so serialize() can avoid saving
          // the intermediate broken/moved location
          try {
            st.__deferredRestore = true;
          } catch (e) {}
        } catch (e) {}

        // Show player's death modal after restoring the statue state
        try {
          const onCloseAfterRestore = () => {
            try {
              // allow autosave now and notify systems so the final correct state
              // is persisted by the normal autosave handlers
              try {
                if (typeof window !== "undefined") window.__skipSaving = false;
              } catch (e) {}
              try {
                // clear pending restore marker so future saves behave normally
                st.__deferredRestore = false;
              } catch (e) {}
              if (typeof emit === "function") {
                try {
                  emit("statueChanged", { statue: st });
                } catch (e) {}
                try {
                  emit("playerMoved", { reason: "statueRestoreOnClose" });
                } catch (e) {}
                try {
                  emit("floorChanged", st.floor);
                } catch (e) {}
              }
            } catch (e) {}
          };

          if (typeof p.triggerFall === "function") {
            try {
              // PASS the correct onClose handler (was incorrectly using onCloseReset)
              p.triggerFall("像の落下で轢かれてしまった...", {
                onClose: onCloseAfterRestore,
              });
            } catch (e) {
              try {
                p.triggerFall("像の落下で轢かれてしまった...");
              } catch (ee) {}
            }
          } else {
            try {
              showCustomAlert("像の落下で轢かれてしまった...", {
                onClose: onCloseAfterRestore,
                allowOverlayClose: false,
              });
            } catch (e) {
              try {
                showCustomAlert("像の落下で轢かれてしまった...");
              } catch (ee) {}
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // Normal fall: place statue on destination tile and mark broken
    try {
      mapService.setTile(destX, destY, st.nameKey, destFloor);
    } catch (e) {}
    st.x = destX;
    st.y = destY;
    st.floor = destFloor;

    try {
      if (st.obj) {
        st.obj.gridX = destX;
        st.obj.gridY = destY;
        try {
          const brokenTex = PIXI.Texture.from("img/statue_broken.png");
          if (brokenTex) st.obj.sprite.texture = brokenTex;
          try {
            st.obj.sprite.width =
              typeof TILE_SIZE === "number" ? TILE_SIZE : st.obj.sprite.width;
            st.obj.sprite.height =
              typeof TILE_SIZE === "number" ? TILE_SIZE : st.obj.sprite.height;
          } catch (e) {}
        } catch (e) {}
        try {
          st.obj.sprite.visible = st.floor === mapService.getFloor();
        } catch (e) {}
        try {
          st.obj.updatePixelPosition();
        } catch (e) {}
      } else {
        try {
          const g = new GameObject(destX, destY, "img/statue_broken.png");
          g.sprite.visible = st.floor === mapService.getFloor();
          if (_appLayers && _appLayers.entityLayer)
            _appLayers.entityLayer.addChild(g.sprite);
          st.obj = g;
        } catch (e) {}
      }
    } catch (e) {}

    st.moved = true;
    try {
      if (st.obj) st.obj.broken = true;
    } catch (e) {}
    st.broken = true;
    try {
      // broken statue should not respond to interactions (A-button/etc.)
      if (st.obj && st.obj.sprite) {
        try {
          if (typeof st.obj.sprite.interactive !== "undefined")
            st.obj.sprite.interactive = false;
        } catch (e) {}
      }
    } catch (e) {}

    try {
      console.log("[statue] fell", {
        nameKey: st.nameKey,
        destX,
        destY,
        destFloor,
      });
    } catch (e) {}

    // If player ended up on the destination (defensive), schedule immediate restore via triggerFall onClose
    try {
      const p =
        typeof window !== "undefined" && window.__playerInstance
          ? window.__playerInstance
          : null;
      if (
        p &&
        p.gridX === destX &&
        p.gridY === destY &&
        p.floor === destFloor
      ) {
        const resetMovedStatue = () => {
          try {
            try {
              mapService.setTile(destX, destY, 0, destFloor);
            } catch (e) {}
            try {
              mapService.setTile(
                st.initialX,
                st.initialY,
                st.nameKey,
                st.initialFloor
              );
            } catch (e) {}
            st.x = st.initialX;
            st.y = st.initialY;
            st.floor = st.initialFloor;
            if (st.obj) {
              try {
                const origTex = PIXI.Texture.from(
                  st.originalTexturePath || "img/statue.png"
                );
                if (origTex) st.obj.sprite.texture = origTex;
              } catch (e) {}
              try {
                st.obj.sprite.visible = st.floor === mapService.getFloor();
              } catch (e) {}
              try {
                st.obj.updatePixelPosition();
              } catch (e) {}
            } else {
              try {
                const g = new GameObject(
                  st.initialX,
                  st.initialY,
                  st.originalTexturePath || "img/statue.png"
                );
                g.sprite.visible = st.floor === mapService.getFloor();
                if (_appLayers && _appLayers.entityLayer)
                  _appLayers.entityLayer.addChild(g.sprite);
                st.obj = g;
              } catch (e) {}
            }
            st.moved = false;
            if (st.obj) st.obj.broken = false;
            st.removed = false;
          } catch (e) {}

          // persist restored statue state
          try {
            if (typeof emit === "function") {
              try {
                emit("statueChanged", { statue: st });
              } catch (e) {}
              try {
                emit("playerMoved", { reason: "statueResetOnClose" });
              } catch (e) {}
              try {
                emit("floorChanged", st.floor);
              } catch (e) {}
            }
          } catch (e) {}
        };

        // Try to pass callback to triggerFall so restore runs after modal closes
        try {
          // set suppress flag to avoid map reset overwriting our immediate restore
          try {
            if (typeof window !== "undefined")
              window.__suppressMapResetOnFall = true;
          } catch (e) {}

          // ensure we keep autosave suppressed until onClose runs
          try {
            deferredRestoreScheduled = true;
          } catch (e) {}
          try {
            // mark statue as pending restore so serialize() avoids saving broken state
            try {
              st.__deferredRestore = true;
            } catch (e) {}
          } catch (e) {}

          const onCloseReset = () => {
            try {
              resetMovedStatue();
            } catch (e) {}
            try {
              if (typeof window !== "undefined")
                window.__suppressMapResetOnFall = false;
            } catch (e) {}
            try {
              // clear pending restore marker
              try {
                st.__deferredRestore = false;
              } catch (e) {}
            } catch (e) {}
            // re-enable saving now and notify systems to persist the restored state
            try {
              if (typeof window !== "undefined") window.__skipSaving = false;
            } catch (e) {}
            try {
              if (typeof emit === "function") {
                try {
                  emit("statueChanged", { statue: st });
                } catch (e) {}
                try {
                  emit("playerMoved", { reason: "statueResetOnClose" });
                } catch (e) {}
                try {
                  emit("floorChanged", st.floor);
                } catch (e) {}
              }
            } catch (e) {}
          };

          if (typeof p.triggerFall === "function") {
            try {
              p.triggerFall("像の落下で轢かれてしまった...", {
                onClose: onCloseReset,
              });
            } catch (e) {
              try {
                p.triggerFall("像の落下で轢かれてしまった...");
              } catch (ee) {}
            }
          } else {
            try {
              showCustomAlert("像の落下で轢かれてしまった...", {
                onClose: onCloseReset,
                allowOverlayClose: false,
              });
            } catch (e) {
              try {
                showCustomAlert("像の落下で轢かれてしまった...");
              } catch (ee) {}
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // kill snakes at destination and notify
    try {
      const killed = snakeManager.killSnakeAt(destX, destY, destFloor);
      if (killed && killed.length)
        try {
          showCustomAlert("像の落下で蛇が倒された。");
        } catch (e) {}
    } catch (e) {}

    try {
      showCustomAlert("像が穴に落ちて下の階に落下した。");
    } catch (e) {}

    // ensure autosave re-enabled and request save for final state
    try {
      if (typeof window !== "undefined") {
        // Only re-enable autosave here if we did not schedule a deferred restore
        if (!deferredRestoreScheduled) window.__skipSaving = false;
      }
    } catch (e) {}
    try {
      if (typeof emit === "function" && !deferredRestoreScheduled) {
        try {
          emit("statueChanged", { statue: st });
        } catch (e) {}
        try {
          emit("playerMoved", { reason: "statueFallComplete" });
        } catch (e) {}
        try {
          emit("floorChanged", st.floor);
        } catch (e) {}
      }
    } catch (e) {}
  } catch (e) {
    console.error("_applyFallenStatueEffects failed", e);
    try {
      if (typeof window !== "undefined") {
        if (!deferredRestoreScheduled) window.__skipSaving = false;
      }
    } catch (ee) {}
  }
}

function _getDisplayNameKeyByName(name) {
  const n = (name || "").normalize
    ? (name || "").normalize("NFKC").trim()
    : (name || "").trim();
  for (const k of Object.keys(STATUE_DISPLAY || {})) {
    try {
      const v = STATUE_DISPLAY[k] || "";
      const vn = v.normalize ? v.normalize("NFKC").trim() : String(v).trim();
      if (vn === n) return k;
      if (k === n) return k; // allow passing the internal key
    } catch (e) {
      if (STATUE_DISPLAY[k] === name) return k;
    }
  }
  return null;
}

export function handleMoveByDisplayName(displayName, dir) {
  const nameKey = _getDisplayNameKeyByName(displayName);
  if (!nameKey) return { ok: false, msg: "その像は見つからないようだ" };
  const targets = statues.filter((st) => st.nameKey === nameKey);
  if (!targets || targets.length === 0)
    return { ok: false, msg: "その像は見つからないようだ" };

  // Enforce ムーブ option from チェンジ (同じ/違う) if present. This only
  // affects which statues may be specified by the player. For the special
  // statue_m case we validate availability but keep the existing behavior of
  // moving the linked 6F statue when the 2F one is targeted.
  try {
    const moveCfg =
      window.__changeState && window.__changeState.global
        ? window.__changeState.global.move
        : null;
    const playerFloor =
      window && window.__playerInstance ? window.__playerInstance.floor : null;
    if (moveCfg && moveCfg.opt) {
      const opt = moveCfg.opt; // '同じ' or '違う'
      if (nameKey === "statue_m") {
        // For マイク, require at least one instance matching the opt
        const hasSame = targets.some((t) => t.floor === playerFloor);
        const hasDiff = targets.some((t) => t.floor !== playerFloor);
        if (opt === "同じ" && !hasSame) {
          return { ok: false, msg: "その像は動かせないようだ" };
        }
        if (opt === "違う" && !hasDiff) {
          return { ok: false, msg: "その像は動かせないようだ" };
        }
      } else {
        let filtered = targets;
        if (opt === "同じ")
          filtered = targets.filter((t) => t.floor === playerFloor);
        else if (opt === "違う")
          filtered = targets.filter((t) => t.floor !== playerFloor);
        if (!filtered || filtered.length === 0) {
          return { ok: false, msg: "その像は動かせないようだ" };
        }
        var effectiveTargets = filtered;
      }
    }
  } catch (e) {}

  const getVecForFloor = (d, floor) => {
    if (floor === 5) {
      if (d === "北") return [-1, 0];
      if (d === "東") return [0, -1];
      if (d === "南") return [1, 0];
      if (d === "西") return [0, 1];
    } else {
      if (d === "北") return [0, -1];
      if (d === "東") return [1, 0];
      if (d === "南") return [0, 1];
      if (d === "西") return [-1, 0];
    }
    return null;
  };

  const handleStatueM = () => {
    const s2 = statues.find(
      (st) => st.nameKey === "statue_m" && st.floor === 2
    );
    const s6 = statues.find(
      (st) => st.nameKey === "statue_m" && st.floor === 6
    );
    if (dir !== "北")
      return { ok: false, msg: "その像は北にしか動かせないようだ" };

    if (s2) {
      if (s2.x !== 7 || s2.y !== 5) {
        return { ok: false, msg: "その像は動かせないようだ" };
      }
      try {
        const oldX2 = s2.x;
        const oldY2 = s2.y;
        const targetX2 = 3;
        const targetY2 = 2;
        try {
          const t2 = mapService.getTile(targetX2, targetY2, s2.floor);
          if (t2 === TILE.HOLE || t2 === "hole") {
            const newFloor2 = Math.max(1, s2.floor - 1);
            let destX2 = targetX2;
            let destY2 = targetY2;
            let destFloor2 = newFloor2;
            try {
              const cushionMap = window.__cushionMap || {};
              const directKeys = [
                `${targetX2},${targetY2},${s2.floor}`,
                `${targetX2},${targetY2},${newFloor2}`,
                `${targetX2},${targetY2},${destFloor2}`,
              ];
              let found2 = null;
              for (const k of directKeys) {
                if (
                  cushionMap &&
                  Object.prototype.hasOwnProperty.call(cushionMap, k)
                ) {
                  found2 = cushionMap[k];
                  break;
                }
              }
              if (!found2) {
                for (const [k, v] of Object.entries(cushionMap)) {
                  const parts = (k || "").split(",");
                  if (parts.length >= 2) {
                    const kx = parseInt(parts[0], 10);
                    const ky = parseInt(parts[1], 10);
                    if (kx === targetX2 && ky === targetY2) {
                      found2 = v;
                      break;
                    }
                  }
                }
              }
              if (!found2)
                return { ok: false, msg: "その像は動かせないようだ" };
              destX2 = typeof found2.x === "number" ? found2.x : destX2;
              destY2 = typeof found2.y === "number" ? found2.y : destY2;
              destFloor2 = typeof found2.f === "number" ? found2.f : destFloor2;
            } catch (e) {}

            try {
              mapService.setTile(oldX2, oldY2, 0, s2.floor);
            } catch (e) {}
            try {
              _applyFallenStatueEffects(s2, destX2, destY2, destFloor2);
            } catch (e) {
              console.error(
                "failed applying fallen effects for statue_m (2F)",
                e
              );
            }
          } else {
            try {
              mapService.setTile(s2.x, s2.y, 0, s2.floor);
              mapService.setTile(targetX2, targetY2, "statue_m", 2);
              s2.x = targetX2;
              s2.y = targetY2;
              s2.obj.gridX = targetX2;
              s2.obj.gridY = targetY2;
              s2.obj.updatePixelPosition();
            } catch (e) {}
          }
        } catch (e) {}
      } catch (e) {}
    }

    if (s6) {
      const vec6 = getVecForFloor("北", 6);
      const oldX6 = s6.x;
      const oldY6 = s6.y;
      const w = mapService.getWidth();
      const h = mapService.getHeight();
      let blocked6 = false;
      let fell6 = false;
      let targetX6 = oldX6;
      let targetY6 = oldY6;
      for (let step = 1; step <= 5; step++) {
        const nx = oldX6 + vec6[0] * step;
        const ny = oldY6 + vec6[1] * step;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
          blocked6 = true;
          break;
        }
        const t = mapService.getTile(nx, ny, 6);
        if (t === TILE.WALL || t === 1) {
          blocked6 = true;
          break;
        }
        if (t === TILE.HOLE || t === "hole") {
          targetX6 = nx;
          targetY6 = ny;
          fell6 = true;
          break;
        }
        if (step === 5) {
          targetX6 = nx;
          targetY6 = ny;
        }
      }
      if (!blocked6) {
        if (fell6) {
          const newFloor6 = Math.max(1, 6 - 1);
          let destX6 = targetX6;
          let destY6 = targetY6;
          let destFloor6 = newFloor6;
          try {
            const cushionMap = window.__cushionMap || {};
            const directKeys = [
              `${targetX6},${targetY6},${6}`,
              `${targetX6},${targetY6},${newFloor6}`,
              `${targetX6},${targetY6},${destFloor6}`,
            ];
            let found6 = null;
            for (const k of directKeys) {
              if (
                cushionMap &&
                Object.prototype.hasOwnProperty.call(cushionMap, k)
              ) {
                found6 = cushionMap[k];
                break;
              }
            }
            if (!found6) {
              for (const [k, v] of Object.entries(cushionMap)) {
                const parts = (k || "").split(",");
                if (parts.length >= 2) {
                  const kx = parseInt(parts[0], 10);
                  const ky = parseInt(parts[1], 10);
                  if (kx === targetX6 && ky === targetY6) {
                    found6 = v;
                    break;
                  }
                }
              }
            }
            if (!found6) return { ok: false, msg: "その像は動かせないようだ" };
            destX6 = typeof found6.x === "number" ? found6.x : destX6;
            destY6 = typeof found6.y === "number" ? found6.y : destY6;
            destFloor6 = typeof found6.f === "number" ? found6.f : destFloor6;
          } catch (e) {}

          try {
            mapService.setTile(oldX6, oldY6, 0, 6);
          } catch (e) {}
          try {
            _applyFallenStatueEffects(s6, destX6, destY6, destFloor6);
          } catch (e) {
            console.error("failed applying fallen effects for statue_m", e);
          }
        } else {
          try {
            mapService.setTile(oldX6, oldY6, 0, 6);
            mapService.setTile(targetX6, targetY6, "statue_m", 6);
            s6.x = targetX6;
            s6.y = targetY6;
            s6.obj.gridX = targetX6;
            s6.obj.gridY = targetY6;
            s6.obj.updatePixelPosition();
          } catch (e) {}
        }
      }
    }
    return { ok: true };
  };

  const handleGeneric = (st) => {
    if (st.moved) return { ok: false, msg: "その像はもう動かせないようだ" };
    try {
      if (st.nameKey === "statue_j" && dir !== "北")
        return { ok: false, msg: "その像は北にしか動かせないようだ" };
    } catch (e) {}
    const vec = getVecForFloor(dir, st.floor);
    if (!vec) return { ok: false, msg: "入力が正しくないようだ" };
    const oldX = st.x;
    const oldY = st.y;
    const floor = st.floor;
    const w = mapService.getWidth();
    const h = mapService.getHeight();
    let blocked = false;
    let fell = false;
    let targetX = oldX;
    let targetY = oldY;
    for (let step = 1; step <= 5; step++) {
      const nx = oldX + vec[0] * step;
      const ny = oldY + vec[1] * step;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
        blocked = true;
        break;
      }
      const t = mapService.getTile(nx, ny, floor);
      if (t === TILE.WALL || t === 1) {
        blocked = true;
        break;
      }
      if (t === TILE.HOLE || t === "hole") {
        targetX = nx;
        targetY = ny;
        fell = true;
        break;
      }
      if (step === 5) {
        targetX = nx;
        targetY = ny;
      }
    }
    if (blocked) return { ok: false, msg: "入力が正しくないようだ" };

    if (fell) {
      const newFloor = Math.max(1, floor - 1);
      try {
        mapService.setTile(oldX, oldY, 0, floor);
      } catch (e) {}
      let destX = targetX;
      let destY = targetY;
      let destFloor = newFloor;
      try {
        const cushionMap = window.__cushionMap || {};
        const directKeys = [
          `${targetX},${targetY},${floor}`,
          `${targetX},${targetY},${newFloor}`,
          `${targetX},${targetY},${destFloor}`,
        ];
        let found = null;
        for (const k of directKeys) {
          if (
            cushionMap &&
            Object.prototype.hasOwnProperty.call(cushionMap, k)
          ) {
            found = cushionMap[k];
            break;
          }
        }
        if (!found) {
          for (const [k, v] of Object.entries(cushionMap)) {
            const parts = (k || "").split(",");
            if (parts.length >= 2) {
              const kx = parseInt(parts[0], 10);
              const ky = parseInt(parts[1], 10);
              if (kx === targetX && ky === targetY) {
                found = v;
                break;
              }
            }
          }
        }
        if (!found) return { ok: false, msg: "その像は動かせないようだ" };
        destX = typeof found.x === "number" ? found.x : destX;
        destY = typeof found.y === "number" ? found.y : destY;
        destFloor = typeof found.f === "number" ? found.f : destFloor;
      } catch (e) {}

      _applyFallenStatueEffects(st, destX, destY, destFloor);

      return { ok: true };
    }

    try {
      mapService.setTile(oldX, oldY, 0, floor);
      mapService.setTile(targetX, targetY, st.nameKey, floor);
    } catch (e) {}
    st.x = targetX;
    st.y = targetY;
    try {
      st.obj.gridX = targetX;
      st.obj.gridY = targetY;
      st.obj.updatePixelPosition();
    } catch (e) {}
    try {
      st.moved = true;
      st.broken = false;
      if (st.obj) st.obj.broken = false;
    } catch (e) {}
    return true;
  };

  let movedOK = true;
  if (nameKey === "statue_m") {
    const res = handleStatueM();
    movedOK = res && res.ok !== false;
    if (res && res.ok === false) return res;
  } else {
    const listToProcess =
      typeof effectiveTargets !== "undefined" ? effectiveTargets : targets;
    for (const st of listToProcess) {
      const res = handleGeneric(st);
      if (!res || res.ok === false) {
        movedOK = false;
        return res;
      }
    }
  }

  return { ok: true };
}

export function reset() {
  statues = [];
  try {
    if (_floorListener) off("floorChanged", _floorListener);
  } catch (e) {}
  _appLayers = null;
}

export function serialize() {
  try {
    return statues.map((s) => {
      try {
        if (s && s.__deferredRestore) {
          // if a deferred restore is pending, prefer initial position and
          // report as not moved/broken so intermediate broken state is not saved
          return {
            x: s.initialX,
            y: s.initialY,
            floor: s.initialFloor,
            nameKey: s.nameKey,
            moved: false,
            removed: false,
            broken: false,
            initialX: s.initialX,
            initialY: s.initialY,
            initialFloor: s.initialFloor,
          };
        }
      } catch (e) {}
      return {
        x: s.x,
        y: s.y,
        floor: s.floor,
        nameKey: s.nameKey,
        moved: !!s.moved,
        removed: !!s.removed,
        broken: !!(s.broken || (s.obj && s.obj.broken)),
        initialX: s.initialX,
        initialY: s.initialY,
        initialFloor: s.initialFloor,
      };
    });
  } catch (e) {
    console.error("statueManager.serialize failed", e);
    return null;
  }
}

export function deserialize(arr) {
  try {
    if (!Array.isArray(arr)) return false;
    // We will attempt to reconcile existing statues with saved positions.
    for (const item of arr) {
      try {
        const found = statues.find(
          (s) =>
            s.nameKey === item.nameKey && s.initialFloor === item.initialFloor
        );
        if (found) {
          // update model fields
          found.x = typeof item.x === "number" ? item.x : found.x;
          found.y = typeof item.y === "number" ? item.y : found.y;
          found.floor =
            typeof item.floor === "number" ? item.floor : found.floor;
          found.moved = !!item.moved;
          found.broken = !!item.broken;
          found.removed = !!item.removed;

          // reconcile map tile and sprite according to removed/moved flags
          try {
            if (found.removed) {
              // clear any tile at the statue's position and remove sprite
              try {
                mapService.setTile(found.x, found.y, 0, found.floor);
              } catch (e) {}
              try {
                if (found.obj && found.obj.sprite) {
                  if (
                    found.obj.sprite.parent &&
                    typeof found.obj.sprite.parent.removeChild === "function"
                  ) {
                    found.obj.sprite.parent.removeChild(found.obj.sprite);
                  }
                }
              } catch (e) {}
              // drop object reference so game treats it as removed
              found.obj = null;
            } else {
              // ensure the map shows the statue at its saved position
              try {
                mapService.setTile(
                  found.x,
                  found.y,
                  found.nameKey,
                  found.floor
                );
              } catch (e) {}

              // update GameObject if present
              try {
                if (found.obj) {
                  found.obj.gridX = found.x;
                  found.obj.gridY = found.y;
                  // apply broken texture if statue was moved/broken
                  try {
                    if (found.broken) {
                      const brokenTex = PIXI.Texture.from(
                        "img/statue_broken.png"
                      );
                      if (brokenTex) found.obj.sprite.texture = brokenTex;
                    } else {
                      const origTex = PIXI.Texture.from(
                        found.originalTexturePath || "img/statue.png"
                      );
                      if (origTex) found.obj.sprite.texture = origTex;
                    }
                  } catch (e) {}

                  try {
                    found.obj.updatePixelPosition();
                    if (found.obj.sprite)
                      found.obj.sprite.visible =
                        found.floor === mapService.getFloor();

                    // ensure broken or removed statues are not interactive (avoid A-button after reload)
                    try {
                      if (
                        found.obj.sprite &&
                        typeof found.obj.sprite.interactive !== "undefined"
                      ) {
                        found.obj.sprite.interactive = !!(
                          !found.broken && !found.removed
                        );
                        // if removed, also hide/intercept input
                        if (found.removed) found.obj.sprite.visible = false;
                      }
                    } catch (e) {}
                  } catch (e) {}

                  // ensure sprite is attached to entity layer
                  try {
                    if (
                      _appLayers &&
                      _appLayers.entityLayer &&
                      found.obj.sprite &&
                      !found.obj.sprite.parent
                    ) {
                      _appLayers.entityLayer.addChild(found.obj.sprite);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    return true;
  } catch (e) {
    console.error("statueManager.deserialize failed", e);
    return false;
  }
}
