import {
  MAPS as INITIAL_MAPS,
  ORIGINAL_MAPS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE,
  MAP_IMAGES,
} from "../core/constants.js";
import { emit } from "../core/eventBus.js";

let currentFloor = 1;
let maps = Object.fromEntries(
  Object.entries(INITIAL_MAPS).map(([k, v]) => [k, v.map((r) => r.slice())])
);

export function setFloor(floor) {
  if (!maps[floor]) {
    // create empty floor if missing
    maps[floor] = Array.from({ length: MAP_HEIGHT }, () =>
      Array.from({ length: MAP_WIDTH }, () => 0)
    );
  }
  currentFloor = floor;
}
export function getFloor() {
  return currentFloor;
}
export function getTile(x, y, floor = currentFloor) {
  const map = maps[floor];
  return map && map[y] && map[y][x];
}
export function setTile(x, y, val, floor = currentFloor) {
  const map = maps[floor];
  if (map && map[y]) map[y][x] = val;
}
export function resetMap(floor = currentFloor) {
  if (ORIGINAL_MAPS[floor])
    maps[floor] = ORIGINAL_MAPS[floor].map((r) => r.slice());
}
export function getWidth() {
  return MAP_WIDTH;
}
export function getHeight() {
  return MAP_HEIGHT;
}

export function getMapImage(floor = currentFloor) {
  return MAP_IMAGES[floor] || MAP_IMAGES[1];
}

export async function onFall(options = {}) {
  // When the player falls, restore runtime state from localStorage (if present)
  // instead of performing a full browser reload so console output remains visible.
  try {
    console.log(
      "player fell: attempting to restore saved state from localStorage instead of full reload"
    );

    // load saved state using stateManager (dynamic import to avoid circular deps)
    let saved = null;
    let sm = null;
    try {
      sm = await import("./stateManager.js");
      if (sm && typeof sm.load === "function") {
        saved = sm.load();
      }
    } catch (e) {
      console.error("mapService.onFall: failed to load stateManager", e);
    }

    if (!saved) {
      console.log(
        "mapService.onFall: no saved state found, falling back to resetting current floor"
      );
      try {
        resetMap(currentFloor);
      } catch (e) {}
      return;
    }

    // restore runtime map first so tiles/statues/snakes align
    try {
      if (saved.map && typeof deserialize === "function") {
        deserialize(saved.map);
      }
    } catch (e) {
      console.error("mapService.onFall: failed to deserialize map", e);
    }

    // restore statues, snakes, puzzles, magic, etc. using dynamic imports to avoid circular imports
    try {
      const m = await import("./statueManager.js");
      if (m && typeof m.deserialize === "function")
        m.deserialize(saved.statues);
    } catch (e) {
      console.error("mapService.onFall: failed to restore statues", e);
    }

    try {
      const s = await import("./snakeManager.js");
      if (s && typeof s.deserialize === "function") s.deserialize(saved.snakes);
    } catch (e) {
      console.error("mapService.onFall: failed to restore snakes", e);
    }

    try {
      const p = await import("./puzzleManager.js");
      if (p && typeof p.deserialize === "function")
        p.deserialize(saved.puzzles);
    } catch (e) {
      console.error("mapService.onFall: failed to restore puzzles", e);
    }

    try {
      const mm = await import("./magicManager.js");
      if (mm && typeof mm.deserialize === "function")
        mm.deserialize(saved.magic);
    } catch (e) {
      console.error("mapService.onFall: failed to restore magic state", e);
    }

    // If the fall was caused by a moved-by-move statue, apply a post-restore fix so
    // the statue is reset to its initial position in both runtime and saved state.
    try {
      if (options && options.fallCause && options.fallCause.movedByMoveStatue) {
        try {
          const info = options.fallCause.movedByMoveStatue;
          console.log(
            "mapService.onFall: applying movedByMoveStatue post-restore fix",
            info
          );

          // update runtime map: clear broken destination and restore statue at initial
          try {
            if (typeof info.destX === "number") {
              setTile(info.destX, info.destY, 0, info.destFloor);
            }
            setTile(
              info.initialX,
              info.initialY,
              info.nameKey,
              info.initialFloor
            );
          } catch (e) {
            console.error(
              "mapService.onFall: failed to apply runtime tile changes for move-reset",
              e
            );
          }

          // update statue object in statueManager if present
          try {
            const statM = await import("./statueManager.js");
            if (statM && typeof statM.getStatues === "function") {
              const arr = statM.getStatues() || [];
              const st = arr.find(
                (s) =>
                  s &&
                  s.nameKey === info.nameKey &&
                  s.initialFloor === info.initialFloor
              );
              if (st) {
                try {
                  st.x = info.initialX;
                  st.y = info.initialY;
                  st.floor = info.initialFloor;
                  st.moved = false;
                  st.removed = false;
                  st._movedByMove = false;
                  if (st.obj) {
                    st.obj.gridX = info.initialX;
                    st.obj.gridY = info.initialY;
                    try {
                      const origTex = PIXI.Texture.from(
                        st.originalTexturePath || "img/statue.png"
                      );
                      if (origTex) st.obj.sprite.texture = origTex;
                    } catch (e) {}
                    try {
                      st.obj.sprite.visible = st.floor === getFloor();
                      st.obj.updatePixelPosition();
                    } catch (e) {}
                  }
                  console.log(
                    "mapService.onFall: updated runtime statue object for reset",
                    {
                      nameKey: st.nameKey,
                      to: { x: st.x, y: st.y, floor: st.floor },
                    }
                  );
                } catch (e) {
                  console.error(
                    "mapService.onFall: failed updating statue object",
                    e
                  );
                }
              } else {
                console.log(
                  "mapService.onFall: no runtime statue found to patch for",
                  info
                );
              }
            }
          } catch (e) {
            console.error(
              "mapService.onFall: statueManager import/patch failed",
              e
            );
          }

          // persist updated saved state so future restores reflect the reset as well
          try {
            if (
              sm &&
              typeof sm.load === "function" &&
              typeof sm.save === "function"
            ) {
              try {
                const saved2 = sm.load() || {};
                saved2.statues = Array.isArray(saved2.statues)
                  ? saved2.statues
                  : [];
                const idx = saved2.statues.findIndex(
                  (it) =>
                    it &&
                    it.nameKey === info.nameKey &&
                    it.initialFloor === info.initialFloor
                );
                const newEntry = {
                  x: info.initialX,
                  y: info.initialY,
                  floor: info.initialFloor,
                  nameKey: info.nameKey,
                  moved: false,
                  removed: false,
                  initialX: info.initialX,
                  initialY: info.initialY,
                  initialFloor: info.initialFloor,
                };
                if (idx >= 0)
                  saved2.statues[idx] = Object.assign(
                    saved2.statues[idx] || {},
                    newEntry
                  );
                else saved2.statues.push(newEntry);

                // patch saved.map if present
                try {
                  if (saved2.map && saved2.map.maps) {
                    const mapsObj = saved2.map.maps;
                    const fk = String(info.destFloor);
                    try {
                      if (
                        mapsObj[fk] &&
                        Array.isArray(mapsObj[fk]) &&
                        Array.isArray(mapsObj[fk][info.destY])
                      ) {
                        mapsObj[fk][info.destY][info.destX] = 0;
                      }
                    } catch (e) {}
                    const fk2 = String(info.initialFloor);
                    try {
                      if (
                        mapsObj[fk2] &&
                        Array.isArray(mapsObj[fk2]) &&
                        Array.isArray(mapsObj[fk2][info.initialY])
                      ) {
                        mapsObj[fk2][info.initialY][info.initialX] =
                          info.nameKey;
                      }
                    } catch (e) {}
                  }
                } catch (e) {}

                try {
                  sm.save(saved2);
                  console.log(
                    "mapService.onFall: persisted movedByMove reset into save"
                  );
                } catch (e) {
                  console.error(
                    "mapService.onFall: failed to save updated state",
                    e
                  );
                }
              } catch (e) {
                console.error(
                  "mapService.onFall: failed preparing saved2 for move-reset",
                  e
                );
              }
            }
          } catch (e) {}
        } catch (e) {
          console.error(
            "mapService.onFall: error applying post-restore movedByMove fix",
            e
          );
        }
      }
    } catch (e) {}

    // notify visuals to refresh for the current floor
    try {
      if (emit && typeof emit === "function") emit("floorChanged", getFloor());
    } catch (e) {
      console.error("mapService.onFall: emit floorChanged failed", e);
    }

    // restore player runtime state if available
    try {
      if (window && window.__playerInstance && saved.player) {
        try {
          window.__playerInstance.deserialize(saved.player);
        } catch (e) {
          console.error("mapService.onFall: failed to deserialize player", e);
        }
      }
    } catch (e) {
      console.error("mapService.onFall: player restore failed", e);
    }

    console.log("mapService.onFall: restored game state from save");
    return;
  } catch (e) {
    console.error(
      "mapService.onFall: restore failed, falling back to resetMap",
      e
    );
  }

  // fallback: reset current floor map
  try {
    console.log(
      "mapService.onFall: fallback reset current floor map",
      currentFloor
    );
    resetMap(currentFloor);
  } catch (e) {
    console.log("mapService.onFall fallback reset failed", e);
  }
}

export function serialize() {
  try {
    const copy = Object.fromEntries(
      Object.entries(maps).map(([k, v]) => [k, v.map((r) => r.slice())])
    );
    return { maps: copy, currentFloor };
  } catch (e) {
    console.error("mapService.serialize failed", e);
    return null;
  }
}

export function deserialize(obj) {
  try {
    if (!obj || !obj.maps) return false;
    const loaded = Object.fromEntries(
      Object.entries(obj.maps).map(([k, v]) => [k, v.map((r) => r.slice())])
    );
    maps = loaded;
    if (typeof obj.currentFloor === "number") currentFloor = obj.currentFloor;
    return true;
  } catch (e) {
    console.error("mapService.deserialize failed", e);
    return false;
  }
}
