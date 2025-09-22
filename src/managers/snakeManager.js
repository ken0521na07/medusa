import GameObject from "../entities/gameObject.js";
import {
  TILE,
  MAP_WIDTH,
  MAP_HEIGHT,
  MAPS,
  SNAKE_DEFS,
} from "../core/constants.js";
import * as mapService from "./mapService.js";
import { loadAssets } from "../core/assets.js";
import { on, off } from "../core/eventBus.js";

let snakes = []; // array of { id, floor, path, index, dir, mode, sprite, addedToLayer }
let _nextId = 1;
let _appLayers = null;
let _floorListener = null;
let _assetsLoaded = false;

// Ensure each snake GameObject reflects the current model (x,y,floor)
function _ensureSpritesMatchMap() {
  try {
    for (const s of snakes) {
      if (!s) continue;
      try {
        if (s.sprite) {
          // keep grid coords in sync with current path/index
          try {
            const pos = s.path && s.path[s.index];
            if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
              s.sprite.gridX = pos.x;
              s.sprite.gridY = pos.y;
              s.sprite.updatePixelPosition();
            }
          } catch (e) {}
          // visibility based on current floor
          try {
            s.sprite.sprite.visible = s.floor === mapService.getFloor();
          } catch (e) {}
          // ensure sprite is attached to entity layer exactly once
          try {
            if (
              _appLayers &&
              _appLayers.entityLayer &&
              s.sprite.sprite &&
              !s.sprite.sprite.parent
            ) {
              _appLayers.entityLayer.addChild(s.sprite.sprite);
              s.addedToLayer = true;
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {}
}

function makeGameObjectForSnake(snakeDef) {
  // use static image for 'static' mode, red image for 'unclock' mode, default otherwise
  // Prefer using the normal snake image for static snakes to avoid requiring
  // an additional file. Use red image for 'unclock' mode, default otherwise.
  let imgPath = "img/snake.png";
  if (snakeDef && snakeDef.mode === "static") {
    imgPath = "img/snake_static.png";
  } else if (snakeDef && snakeDef.mode === "unclock") {
    imgPath = "img/snake_red.png";
  }
  const g = new GameObject(
    snakeDef.path[snakeDef.index].x,
    snakeDef.path[snakeDef.index].y,
    imgPath
  );
  return g;
}

function findConnectedComponents(pointsSet) {
  // pointsSet: Set of 'x,y' strings. Return array of arrays of {x,y}
  const res = [];
  const seen = new Set();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const key of pointsSet) {
    if (seen.has(key)) continue;
    const [sx, sy] = key.split(",").map((v) => parseInt(v, 10));
    const stack = [[sx, sy]];
    const comp = [];
    seen.add(key);
    while (stack.length) {
      const [x, y] = stack.pop();
      comp.push({ x, y });
      for (const d of dirs) {
        const nx = x + d[0];
        const ny = y + d[1];
        const nk = nx + "," + ny;
        if (pointsSet.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push([nx, ny]);
        }
      }
    }
    res.push(comp);
  }
  return res;
}

export async function initSnakes(appLayers, { autoFromMap = true } = {}) {
  _appLayers = appLayers;
  if (!_assetsLoaded) {
    try {
      // preload snake images (normal, red, static, dead)
      // load images we actually ship: normal, red and dead variants
      await loadAssets([
        "img/snake.png",
        "img/snake_red.png",
        "img/snake_static.png",
        "img/snake_dead.png",
      ]);
      _assetsLoaded = true;
    } catch (e) {}
  }

  // auto-detect snake paths from MAPS if requested
  if (autoFromMap) {
    // iterate through floors defined in MAPS
    const floors = Object.keys(MAPS).map((k) => parseInt(k, 10));
    for (const f of floors) {
      // If explicit snake definitions exist for this floor, use them and skip map auto-detection
      try {
        if (SNAKE_DEFS && SNAKE_DEFS[f] && Array.isArray(SNAKE_DEFS[f])) {
          for (const def of SNAKE_DEFS[f]) {
            try {
              addSnake({
                floor: f,
                path: def.path,
                mode: def.mode || def.type || "loop",
                startIndex: def.startIndex || 0,
              });
            } catch (e) {}
          }
          // Also ensure any plain 'snake' tiles on the map become static snakes.
          // Previously we used `continue` here which skipped auto-detection entirely
          // and therefore missed single-tile static snakes defined directly in MAPS
          // (this caused the B1F plain 'snake' tiles to have no sprite). Scan the
          // map and add static snakes for those tiles, then continue.
          try {
            const w2 = mapService.getWidth();
            const h2 = mapService.getHeight();
            for (let yy = 0; yy < h2; yy++) {
              for (let xx = 0; xx < w2; xx++) {
                try {
                  const tt = mapService.getTile(xx, yy, f);
                  if (tt === TILE.SNAKE || tt === "snake") {
                    try {
                      addSnake({
                        floor: f,
                        path: [{ x: xx, y: yy }],
                        mode: "static",
                      });
                    } catch (e) {}
                  }
                } catch (e) {}
              }
            }
          } catch (e) {}
          continue; // still skip the full route autodetect after handling defs + static tiles
        }
      } catch (e) {}
      // separate point/start sets per tile category to avoid mixing adjacent routes
      const pointsClock = new Set();
      const startsClock = new Set();
      const pointsUnclock = new Set();
      const startsUnclock = new Set();
      const pointsBounce = new Set();
      const startsBounce = new Set();
      const w = mapService.getWidth();
      const h = mapService.getHeight();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = mapService.getTile(x, y, f);
          // plain static snake tile
          try {
            if (t === TILE.SNAKE || t === "snake") {
              // create a static snake object (single-tile)
              try {
                addSnake({ floor: f, path: [{ x, y }], mode: "static" });
              } catch (e) {}
            }
          } catch (e) {}
          // bounce
          if (t === TILE.SNAKE_BOUNCE || t === "snake_bounce") {
            pointsBounce.add(x + "," + y);
          }
          if (t === TILE.SNAKE_BOUNCE_START || t === "snake_bounce_start") {
            pointsBounce.add(x + "," + y);
            startsBounce.add(x + "," + y);
          }
          // clock
          if (t === TILE.SNAKE_CLOCK || t === "snake_clock") {
            pointsClock.add(x + "," + y);
          }
          if (t === TILE.SNAKE_CLOCK_START || t === "snake_clock_start") {
            pointsClock.add(x + "," + y);
            startsClock.add(x + "," + y);
          }
          // unclock
          if (t === TILE.SNAKE_UNCLOCK || t === "snake_unclock") {
            pointsUnclock.add(x + "," + y);
          }
          if (t === TILE.SNAKE_UNCLOCK_START || t === "snake_unclock_start") {
            pointsUnclock.add(x + "," + y);
            startsUnclock.add(x + "," + y);
          }
        }
      }

      // helper to process a category (original behavior): sort connected component by angle
      const processCategory = (pointsSet, startsSet, mode, sortFn) => {
        if (pointsSet.size === 0) return;
        const comps = findConnectedComponents(pointsSet);
        for (const comp of comps) {
          // apply custom sort for ordering
          try {
            sortFn(comp);
          } catch (e) {}
          const sis = [];
          for (let i = 0; i < comp.length; i++) {
            const key = comp[i].x + "," + comp[i].y;
            if (startsSet.has(key)) sis.push(i);
          }
          if (sis.length > 0) {
            for (const sidx of sis)
              addSnake({ floor: f, path: comp, mode, startIndex: sidx });
          } else {
            addSnake({ floor: f, path: comp, mode, startIndex: 0 });
          }
        }
      };

      // process clock: clockwise sort (descending angle)
      processCategory(pointsClock, startsClock, "clock", (comp) => {
        const cx = comp.reduce((s, p) => s + p.x, 0) / comp.length;
        const cy = comp.reduce((s, p) => s + p.y, 0) / comp.length;
        // invert angle to account for grid y-down coordinate system, then normalize
        comp.sort((a, b) => {
          const aa = -Math.atan2(a.y - cy, a.x - cx);
          const ab = -Math.atan2(b.y - cy, b.x - cx);
          const na = (aa + 2 * Math.PI) % (2 * Math.PI);
          const nb = (ab + 2 * Math.PI) % (2 * Math.PI);
          // descending => clockwise
          return nb - na;
        });
      });

      // process unclock: counter-clockwise expected; sort so that stepping backward yields CCW
      processCategory(pointsUnclock, startsUnclock, "unclock", (comp) => {
        const cx = comp.reduce((s, p) => s + p.x, 0) / comp.length;
        const cy = comp.reduce((s, p) => s + p.y, 0) / comp.length;
        // invert angle to account for grid y-down coordinate system, then normalize
        comp.sort((a, b) => {
          const aa = -Math.atan2(a.y - cy, a.x - cx);
          const ab = -Math.atan2(b.y - cy, b.x - cx);
          const na = (aa + 2 * Math.PI) % (2 * Math.PI);
          const nb = (ab + 2 * Math.PI) % (2 * Math.PI);
          // sort descending (clockwise) so that stepping backward (unclock mode) yields counter-clockwise motion
          return nb - na;
        });
      });

      // process bounce (fallback)
      processCategory(pointsBounce, startsBounce, "bounce", (comp) => {
        comp.sort((a, b) => a.y - b.y || a.x - b.x);
      });
    }
  }

  // After auto-detection/additions, ensure static-mode snakes use the static texture
  // and are properly attached/visible. This is a defensive step to avoid races
  // where a static snake on certain floors (e.g. B1F / floor 0) may end up
  // without its expected texture or not re-attached to the entity layer.
  try {
    for (const s of snakes) {
      try {
        if (!s || !s.sprite || !s.sprite.sprite) continue;
        if (s.mode === "static") {
          // explicitly assign the static texture (ensures PIXI resolves it)
          s.sprite.sprite.texture = PIXI.Texture.from("img/snake_static.png");
        }
        // defensive: ensure sprite size/alpha are correct
        try {
          s.sprite.sprite.width =
            typeof PIXI !== "undefined" ? TILE_SIZE : s.sprite.sprite.width;
          s.sprite.sprite.height =
            typeof PIXI !== "undefined" ? TILE_SIZE : s.sprite.sprite.height;
          s.sprite.sprite.alpha = 1.0;
        } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}
  return;
}

// register floor change listener to keep snake sprites in sync
try {
  if (_floorListener) off("floorChanged", _floorListener);
} catch (e) {}
_floorListener = () => {
  try {
    _ensureSpritesMatchMap();
  } catch (e) {}
};
try {
  on("floorChanged", _floorListener);
} catch (e) {}

// internal helper to add a snake definition to runtime
function addSnake({ floor = 1, path = [], mode = "loop", startIndex = 0 }) {
  try {
    if (!Array.isArray(path) || path.length === 0) return null;
    const idx = Math.max(0, Math.min(startIndex || 0, path.length - 1));
    const id = _nextId++;
    const snake = {
      id,
      floor,
      path: path.map((p) => ({ x: p.x, y: p.y })),
      index: idx,
      initialIndex: idx,
      mode: mode || "loop",
      dead: false,
      sprite: null,
      addedToLayer: false,
    };
    try {
      snake.sprite = makeGameObjectForSnake(snake);
      if (snake.sprite && snake.sprite.sprite) {
        snake.sprite.sprite.visible = snake.floor === mapService.getFloor();
        if (_appLayers && _appLayers.entityLayer)
          _appLayers.entityLayer.addChild(snake.sprite.sprite);
        snake.addedToLayer = true;
      }
    } catch (e) {}
    snakes.push(snake);
    return snake;
  } catch (e) {
    console.error("addSnake failed", e);
    return null;
  }
}

// advance snakes one step. options: { onlyVisible: boolean }
export function stepSnakes({ onlyVisible = false } = {}) {
  let moved = false;
  try {
    for (const s of snakes) {
      try {
        if (!s || s.dead) continue;
        if (onlyVisible && s.floor !== mapService.getFloor()) continue;
        const len = s.path ? s.path.length : 0;
        if (len <= 1) continue; // static
        const prevIdx = s.index;
        if (s.mode === "clock") {
          s.index = (s.index + 1) % len;
        } else if (s.mode === "unclock") {
          s.index = (s.index - 1 + len) % len;
        } else if (s.mode === "bounce") {
          // implement simple bounce by storing a direction flag on the object
          if (typeof s._bounceDir === "undefined") s._bounceDir = 1;
          s.index += s._bounceDir;
          if (s.index >= len) {
            s.index = len - 2 >= 0 ? len - 2 : 0;
            s._bounceDir = -1;
          } else if (s.index < 0) {
            s.index = 1 < len ? 1 : 0;
            s._bounceDir = 1;
          }
        } else if (s.mode === "static") {
          // do nothing
        } else {
          // default loop
          s.index = (s.index + 1) % len;
        }
        if (s.index !== prevIdx) moved = true;
        // update sprite position
        try {
          const pos = s.path && s.path[s.index];
          if (pos && s.sprite) {
            s.sprite.gridX = pos.x;
            s.sprite.gridY = pos.y;
            s.sprite.updatePixelPosition();
            if (s.sprite.sprite)
              s.sprite.sprite.visible = s.floor === mapService.getFloor();
          }
        } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}
  return moved;
}

export function getSnakeAt(x, y, floor) {
  try {
    for (const s of snakes) {
      try {
        if (!s || s.dead) continue;
        if (typeof floor === "number" && s.floor !== floor) continue;
        const pos = s.path && s.path[s.index];
        if (pos && pos.x === x && pos.y === y) return s;
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

export function resetPositions() {
  try {
    for (const s of snakes) {
      try {
        s.index = typeof s.initialIndex === "number" ? s.initialIndex : 0;
        // if a snake was killed by a statue, preserve its dead state and texture
        if (s.killedByStatue) {
          s.dead = true;
        } else {
          s.dead = false;
        }
        try {
          if (s.sprite && s.sprite.sprite) {
            // choose texture based on state: dead (any reason) -> dead texture,
            // otherwise static vs normal
            if (s.dead) {
              s.sprite.sprite.texture = PIXI.Texture.from("img/snake_dead.png");
            } else {
              s.sprite.sprite.texture = PIXI.Texture.from(
                s.mode === "static" ? "img/snake_static.png" : "img/snake.png"
              );
            }
            s.sprite.sprite.visible = s.floor === mapService.getFloor();
            s.sprite.updatePixelPosition();
          }
        } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}
}

export function serialize() {
  try {
    return snakes.map((s) => ({
      id: s.id,
      floor: s.floor,
      path: s.path,
      index: s.index,
      mode: s.mode,
      dead: !!s.dead,
      killedByStatue: !!s.killedByStatue,
      initialIndex: typeof s.initialIndex === "number" ? s.initialIndex : 0,
    }));
  } catch (e) {
    console.error("snakeManager.serialize failed", e);
    return null;
  }
}

export function deserialize(arr) {
  try {
    if (!Array.isArray(arr)) return false;
    try {
      for (const s of snakes) {
        try {
          if (s && s.sprite && s.sprite.sprite && s.sprite.sprite.parent) {
            s.sprite.sprite.parent.removeChild(s.sprite.sprite);
          }
        } catch (e) {}
      }
    } catch (e) {}
    snakes = [];
    for (const item of arr) {
      try {
        const n = addSnake({
          floor: item.floor,
          path: Array.isArray(item.path) ? item.path : [],
          mode: item.mode || "loop",
          startIndex: typeof item.index === "number" ? item.index : 0,
        });
        if (n) {
          n.dead = !!item.dead;
          n.killedByStatue = !!item.killedByStatue;
          n.initialIndex =
            typeof item.initialIndex === "number"
              ? item.initialIndex
              : n.initialIndex;
          try {
            if (n.dead && n.sprite && n.sprite.sprite) {
              n.sprite.sprite.texture = PIXI.Texture.from("img/snake_dead.png");
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
    return true;
  } catch (e) {
    console.error("snakeManager.deserialize failed", e);
    return false;
  }
}

export function killSnakeAt(x, y, floor) {
  try {
    const killed = [];
    for (const s of snakes) {
      try {
        if (!s) continue;
        if (typeof floor === "number" && s.floor !== floor) continue;
        const pos = s.path && s.path[s.index];
        if (pos && pos.x === x && pos.y === y) {
          s.dead = true;
          s.killedByStatue = true;
          try {
            if (s.sprite && s.sprite.sprite) {
              s.sprite.sprite.texture = PIXI.Texture.from("img/snake_dead.png");
            }
          } catch (e) {}
          killed.push(s);
        }
      } catch (e) {}
    }
    return killed;
  } catch (e) {
    console.error("killSnakeAt failed", e);
    return null;
  }
}
