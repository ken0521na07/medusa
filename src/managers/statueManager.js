import GameObject from "../entities/gameObject.js";
import { MAPS, STATUE_DISPLAY, TILE, TILE_SIZE } from "../core/constants.js";
import * as mapService from "./mapService.js";
import * as snakeManager from "./snakeManager.js";
import { showCustomAlert } from "../ui/modals.js";
import { on, off } from "../core/eventBus.js";

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
        try {
          if (existing.obj && existing.obj.sprite) {
            // remove from display list if attached
            if (
              existing.obj.sprite.parent &&
              typeof existing.obj.sprite.parent.removeChild === "function"
            ) {
              existing.obj.sprite.parent.removeChild(existing.obj.sprite);
            }
            try {
              existing.obj.sprite.visible = false;
            } catch (e) {}
          }
        } catch (e) {}
        try {
          existing.removed = true;
          existing.obj = null;
        } catch (e) {}
      }
    } catch (e) {}

    // place statue on destination tile
    try {
      mapService.setTile(destX, destY, st.nameKey, destFloor);
    } catch (e) {}

    // update statue model and sprite
    st.x = destX;
    st.y = destY;
    st.floor = destFloor;
    try {
      st.obj.gridX = destX;
      st.obj.gridY = destY;
      st.obj.sprite.visible = st.floor === mapService.getFloor();
      try {
        const brokenTex = PIXI.Texture.from("img/statue_broken.png");
        if (brokenTex) {
          st.obj.sprite.texture = brokenTex;
          try {
            st.obj.sprite.width =
              typeof TILE_SIZE === "number" ? TILE_SIZE : st.obj.sprite.width;
            st.obj.sprite.height =
              typeof TILE_SIZE === "number" ? TILE_SIZE : st.obj.sprite.height;
          } catch (e) {}
        }
      } catch (e) {
        console.error("failed to set broken statue texture", e);
      }
      st.obj.updatePixelPosition();
    } catch (e) {
      console.error("failed to update statue object after fall", e);
    }

    // mark as moved/broken
    try {
      st.moved = true;
      st.obj.broken = true;
    } catch (e) {}

    try {
      console.log("[statue] fell", {
        nameKey: st.nameKey,
        destX,
        destY,
        destFloor,
      });
    } catch (e) {}

    // player death check
    try {
      if (window && window.__playerInstance) {
        const p = window.__playerInstance;
        if (p.gridX === destX && p.gridY === destY && p.floor === destFloor) {
          // If player is crushed by this falling statue, reset the moved statue
          // only after the death alert is closed. Build a callback to perform the reset.
          const resetMovedStatue = async () => {
            try {
              // Only perform the special reset when this statue was moved via ムーブ
              if (!st || !st._movedByMove) {
                try {
                  // clear any transient flag just in case
                  if (st) st._movedByMove = false;
                } catch (e) {}
                try {
                  console.log(
                    "[statue] resetMovedStatue called but _movedByMove is false or statue missing",
                    {
                      nameKey: st && st.nameKey,
                      movedByMove: st && st._movedByMove,
                    }
                  );
                } catch (e) {}
                return;
              }

              try {
                console.log("[statue] resetMovedStatue: performing reset for", {
                  nameKey: st.nameKey,
                  initialX: st.initialX,
                  initialY: st.initialY,
                  initialFloor: st.initialFloor,
                });
              } catch (e) {}

              if (st && typeof st.initialX === "number") {
                try {
                  // clear the destination tile (the broken statue shouldn't remain)
                  mapService.setTile(destX, destY, 0, destFloor);
                } catch (e) {}
                try {
                  // restore statue at its initial position/floor
                  mapService.setTile(
                    st.initialX,
                    st.initialY,
                    st.nameKey,
                    st.initialFloor
                  );
                } catch (e) {}
                try {
                  st.x = st.initialX;
                  st.y = st.initialY;
                  st.floor = st.initialFloor;
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
                      st.obj.sprite.visible =
                        st.floor === mapService.getFloor();
                      st.obj.updatePixelPosition();
                    } catch (e) {}
                  }
                  st.moved = false;
                  if (st.obj) st.obj.broken = false;
                  st.removed = false;
                  try {
                    console.log(
                      "[statue] reset after crushing death (onClose)",
                      {
                        nameKey: st.nameKey,
                        to: { x: st.x, y: st.y, floor: st.floor },
                      }
                    );
                  } catch (e) {}
                } catch (e) {}
                try {
                  // clear the transient flag after reset
                  st._movedByMove = false;
                } catch (e) {}

                // Persist the reset into saved state so later restoration does not overwrite it
                try {
                  const sm = await import("./stateManager.js");
                  if (
                    sm &&
                    typeof sm.load === "function" &&
                    typeof sm.save === "function"
                  ) {
                    try {
                      const saved = sm.load() || {};
                      saved.statues = Array.isArray(saved.statues)
                        ? saved.statues
                        : [];
                      // find matching statue entry by nameKey + initialFloor
                      const idx = saved.statues.findIndex(
                        (it) =>
                          it &&
                          it.nameKey === st.nameKey &&
                          it.initialFloor === st.initialFloor
                      );
                      const newEntry = {
                        x: st.x,
                        y: st.y,
                        floor: st.floor,
                        nameKey: st.nameKey,
                        moved: !!st.moved,
                        removed: !!st.removed,
                        initialX: st.initialX,
                        initialY: st.initialY,
                        initialFloor: st.initialFloor,
                      };
                      if (idx >= 0)
                        saved.statues[idx] = Object.assign(
                          saved.statues[idx] || {},
                          newEntry
                        );
                      else saved.statues.push(newEntry);

                      // Also patch saved.map (if present) to ensure deserializing the map
                      // won't restore the broken statue tile. mapService.serialize stores
                      // maps under saved.map.maps.
                      try {
                        if (saved.map && saved.map.maps) {
                          const mapsObj = saved.map.maps;
                          const setTileInSavedMap = (xx, yy, ff, val) => {
                            try {
                              const fk = String(ff);
                              if (
                                mapsObj[fk] &&
                                Array.isArray(mapsObj[fk]) &&
                                Array.isArray(mapsObj[fk][yy])
                              ) {
                                mapsObj[fk][yy][xx] = val;
                                return true;
                              }
                            } catch (e) {}
                            return false;
                          };

                          // clear dest tile (broken statue) and set statue at initial
                          try {
                            const cleared = setTileInSavedMap(
                              destX,
                              destY,
                              destFloor,
                              0
                            );
                            const placed = setTileInSavedMap(
                              st.initialX,
                              st.initialY,
                              st.initialFloor,
                              st.nameKey
                            );
                            console.log(
                              "[statue] patched saved.map: cleared dest?",
                              !!cleared,
                              "placed at initial?",
                              !!placed
                            );
                          } catch (e) {
                            console.error(
                              "statueManager: failed patching saved.map",
                              e
                            );
                          }
                        }
                      } catch (e) {}

                      try {
                        sm.save(saved);
                        console.log(
                          "[statue] persisted reset to save file for",
                          {
                            nameKey: st.nameKey,
                            to: { x: st.x, y: st.y, floor: st.floor },
                          }
                        );
                      } catch (e) {
                        console.error(
                          "statueManager: failed to save updated state",
                          e
                        );
                      }
                    } catch (e) {
                      console.error(
                        "statueManager: failed updating saved statues",
                        e
                      );
                    }
                  }
                } catch (e) {}
              }
            } catch (e) {}
          };

          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => {
              try {
                p.triggerFall("像の落下で轢かれてしまった...", {
                  onClose: resetMovedStatue,
                  fallCause: {
                    movedByMoveStatue: {
                      nameKey: st.nameKey,
                      initialX: st.initialX,
                      initialY: st.initialY,
                      initialFloor: st.initialFloor,
                      destX,
                      destY,
                      destFloor,
                    },
                  },
                });
              } catch (err) {
                console.error("triggerFall failed on player", err);
              }
            });
          } else {
            p.triggerFall("像の落下で轢かれてしまった...", {
              onClose: resetMovedStatue,
              fallCause: {
                movedByMoveStatue: {
                  nameKey: st.nameKey,
                  initialX: st.initialX,
                  initialY: st.initialY,
                  initialFloor: st.initialFloor,
                  destX,
                  destY,
                  destFloor,
                },
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("player death check failed", e);
    }

    // kill snakes at destination and notify
    try {
      const killed = snakeManager.killSnakeAt(destX, destY, destFloor);
      if (killed && killed.length)
        try {
          showCustomAlert("像の落下で蛇が倒された。");
        } catch (e) {}
    } catch (e) {
      console.error("killSnakeAt failed", e);
    }

    try {
      showCustomAlert("像が穴に落ちて下の階に落下した。");
    } catch (e) {}
  } catch (e) {
    console.error("_applyFallenStatueEffects failed", e);
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

  // Restrict 'ジェシー' to only move 北. If any other direction is attempted,
  // silently reject with the requested message.
  try {
    const normInput =
      displayName && displayName.normalize
        ? displayName.normalize("NFKC").trim()
        : (displayName || "").trim();
    let isJessie = false;
    if (normInput === "ジェシー") isJessie = true;
    try {
      const disp = STATUE_DISPLAY && STATUE_DISPLAY[nameKey];
      const normDisp =
        disp && disp.normalize
          ? disp.normalize("NFKC").trim()
          : (disp || "").trim();
      if (normDisp === "ジェシー") isJessie = true;
    } catch (e) {}
    if (isJessie && dir !== "北") {
      return { ok: false, msg: "それをする必要はないようだ" };
    }
  } catch (e) {}

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
        // keep existing behavior (handleStatueM will operate on both s2 and s6 as before)
      } else {
        // For generic statues, limit the actual targets moved to those that
        // match the opt; if none remain, disallow.
        let filtered = targets;
        if (opt === "同じ")
          filtered = targets.filter((t) => t.floor === playerFloor);
        else if (opt === "違う")
          filtered = targets.filter((t) => t.floor !== playerFloor);
        if (!filtered || filtered.length === 0) {
          return { ok: false, msg: "その像は動かせないようだ" };
        }
        // replace targets array contents for the rest of the function by mutating
        // the local 'targets' variable reference. (we'll shadow it below by reassigning)
        // eslint-disable-next-line no-param-reassign
        // Note: we cannot reassign the const targets, so create a new var for processing
        // the loop below will use 'effectiveTargets'.
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
      // validate there is indeed an instance at expected origin
      if (s2.x !== 7 || s2.y !== 5) {
        return { ok: false, msg: "その像は動かせないようだ" };
      }
      try {
        const oldX2 = s2.x;
        const oldY2 = s2.y;
        const targetX2 = 3;
        const targetY2 = 2;
        // check whether target is a hole -> falling behavior
        try {
          const t2 = mapService.getTile(targetX2, targetY2, s2.floor);
          if (t2 === TILE.HOLE || t2 === "hole") {
            // attempt to resolve cushion mapping (similar to generic case)
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
              if (!found2) {
                // this hole is not mapped -> disallow move
                return { ok: false, msg: "その像は動かせないようだ" };
              }
              destX2 = typeof found2.x === "number" ? found2.x : destX2;
              destY2 = typeof found2.y === "number" ? found2.y : destY2;
              destFloor2 = typeof found2.f === "number" ? found2.f : destFloor2;
            } catch (e) {}

            try {
              // clear origin tile
              mapService.setTile(oldX2, oldY2, 0, s2.floor);
            } catch (e) {}

            // mark as moved-by-move so death resets only move-caused statues
            try {
              s2._movedByMove = true;
              console.log("[statue] mark _movedByMove for s2", {
                nameKey: s2.nameKey,
                x: s2.x,
                y: s2.y,
                floor: s2.floor,
              });
            } catch (e) {}

            // apply shared fall effects so snake kill and alerts occur
            try {
              _applyFallenStatueEffects(s2, destX2, destY2, destFloor2);
            } catch (e) {
              console.error(
                "failed applying fallen effects for statue_m (2F)",
                e
              );
            }
          } else {
            // normal move onto non-hole target
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
          // determine destination using cushion mapping - only allow falls into mapped holes
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
            if (!found6) {
              // this hole is not one of the known cushion-mapped holes -> disallow fall
              return { ok: false, msg: "その像は動かせないようだ" };
            }
            destX6 = typeof found6.x === "number" ? found6.x : destX6;
            destY6 = typeof found6.y === "number" ? found6.y : destY6;
            destFloor6 = typeof found6.f === "number" ? found6.f : destFloor6;
          } catch (e) {}

          try {
            mapService.setTile(oldX6, oldY6, 0, 6);
          } catch (e) {}

          // mark as moved-by-move so death resets only move-caused statues
          try {
            s6._movedByMove = true;
            console.log("[statue] mark _movedByMove for s6", {
              nameKey: s6.nameKey,
              x: s6.x,
              y: s6.y,
              floor: s6.floor,
            });
          } catch (e) {}

          // use shared effect helper so statue_m behaves identically to other statues
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
      return { ok: true };
    }
    return { ok: true };
  };

  const handleGeneric = (st) => {
    if (st.moved) return { ok: false, msg: "その像はもう動かせないようだ" };
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
        if (!found) {
          // this hole is not a known cushion-mapped hole: disallow fall
          return { ok: false, msg: "その像は動かせないようだ" };
        }
        destX = typeof found.x === "number" ? found.x : destX;
        destY = typeof found.y === "number" ? found.y : destY;
        destFloor = typeof found.f === "number" ? found.f : destFloor;
      } catch (e) {}

      // shared fall handling
      try {
        st._movedByMove = true;
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
      // clear moved-by-move flag for normal non-falling move
      try {
        st._movedByMove = false;
      } catch (e) {}
    } catch (e) {}
    return { ok: true };
  };

  let movedOK = true;
  if (nameKey === "statue_m") {
    const res = handleStatueM();
    movedOK = res && res.ok !== false;
    if (res && res.ok === false) return res;
  } else {
    // use effectiveTargets if defined by チェンジ filtering, otherwise use original targets
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
    return statues.map((s) => ({
      x: s.x,
      y: s.y,
      floor: s.floor,
      nameKey: s.nameKey,
      moved: !!s.moved,
      removed: !!s.removed,
      initialX: s.initialX,
      initialY: s.initialY,
      initialFloor: s.initialFloor,
    }));
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
                    if (found.moved) {
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
