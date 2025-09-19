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
            typeof PIXI !== "undefined" &&
            PIXI.settings &&
            typeof PIXI.settings.SCALE_MODE !== "undefined"
              ? s.sprite.sprite.width
              : s.sprite.sprite.width;
        } catch (e) {}
        try {
          s.sprite.sprite.height = s.sprite.sprite.height;
        } catch (e) {}
        try {
          s.sprite.sprite.alpha = 1;
        } catch (e) {}
        // ensure it is attached to the entity layer if layers are available
        try {
          if (_appLayers && _appLayers.entityLayer && !s.sprite.sprite.parent) {
            _appLayers.entityLayer.addChild(s.sprite.sprite);
            s.addedToLayer = true;
          }
        } catch (e) {}
      } catch (e) {}
    }
  } catch (e) {}

  // ensure we toggle sprite visibility on floor change
  try {
    if (_floorListener) off("floorChanged", _floorListener);
  } catch (e) {}
  _floorListener = (f) => {
    try {
      // synchronize all snake sprites with the current map/floor
      _ensureSpritesMatchMap();
      // additionally, remove sprites that are on other floors (defensive)
      for (const s of snakes) {
        try {
          if (!s || !s.sprite || !s.sprite.sprite) continue;
          if (f !== s.floor) {
            if (s.addedToLayer && _appLayers && _appLayers.entityLayer) {
              try {
                _appLayers.entityLayer.removeChild(s.sprite.sprite);
              } catch (e) {}
              s.addedToLayer = false;
            }
            s.sprite.sprite.visible = false;
          }
        } catch (e) {}
      }
    } catch (e) {}
  };
  on("floorChanged", _floorListener);
  // immediately sync sprite visibility with current floor
  try {
    _floorListener(mapService.getFloor());
  } catch (e) {}
}

export function addSnake({ floor = 3, path = [], mode = "bounce" } = {}) {
  if (!path || path.length === 0) return null;
  const id = _nextId++;
  const snakeDef = {
    id,
    floor,
    path: path.map((p) => ({ x: p.x, y: p.y })),
    index: 0,
    // initialIndex records the spawn/starting index so resets return here
    initialIndex: 0,
    dir: -1, // for bounce: -1 start moving 'up' the array, 1 down; for loop: 1 moves forward
    mode, // 'bounce' or 'loop' or 'static' (new)
    sprite: null,
    addedToLayer: false,
  };
  // apply provided startIndex if present
  try {
    if (
      typeof arguments[0].startIndex === "number" &&
      arguments[0].startIndex >= 0 &&
      arguments[0].startIndex < snakeDef.path.length
    ) {
      snakeDef.index = arguments[0].startIndex;
    }
  } catch (e) {}
  // record as initialIndex for future resets
  try {
    snakeDef.initialIndex = snakeDef.index || 0;
  } catch (e) {}
  // create GameObject for this snake
  try {
    snakeDef.sprite = makeGameObjectForSnake(snakeDef);
    // ensure sprite uses the intended texture and dimensions (defensive)
    try {
      const imgPath =
        snakeDef.mode === "static"
          ? "img/snake_static.png"
          : snakeDef.mode === "unclock"
          ? "img/snake_red.png"
          : "img/snake.png";
      try {
        // explicitly set texture to ensure PIXI resolves the cached texture
        if (snakeDef.sprite && snakeDef.sprite.sprite) {
          snakeDef.sprite.sprite.texture = PIXI.Texture.from(imgPath);
          snakeDef.sprite.sprite.width =
            typeof TILE_SIZE !== "undefined"
              ? TILE_SIZE
              : snakeDef.sprite.sprite.width;
          snakeDef.sprite.sprite.height =
            typeof TILE_SIZE !== "undefined"
              ? TILE_SIZE
              : snakeDef.sprite.sprite.height;
          snakeDef.sprite.sprite.alpha = 1;
        }
      } catch (e) {}
    } catch (e) {}
    // add sprite to entity layer if layers are available; set visible according to floor
    try {
      if (
        _appLayers &&
        _appLayers.entityLayer &&
        snakeDef.sprite &&
        snakeDef.sprite.sprite
      ) {
        // avoid adding twice
        if (!snakeDef.sprite.sprite.parent) {
          _appLayers.entityLayer.addChild(snakeDef.sprite.sprite);
        }
        // ensure visibility matches the floor and the sprite is enabled
        try {
          snakeDef.sprite.sprite.visible = mapService.getFloor() === floor;
        } catch (e) {
          snakeDef.sprite.sprite.visible = true;
        }
        snakeDef.addedToLayer = true;
      }
    } catch (e) {}
  } catch (e) {}
  snakes.push(snakeDef);
  try {
    // expose for debugging
    window.__snakes = snakes;
  } catch (e) {}
  return id;
}

export function removeSnake(id) {
  const idx = snakes.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const s = snakes[idx];
  try {
    if (s.addedToLayer && _appLayers && _appLayers.entityLayer) {
      _appLayers.entityLayer.removeChild(s.sprite.sprite);
    }
  } catch (e) {}
  snakes.splice(idx, 1);
  return true;
}

export function stepSnakes({ onlyVisible = true } = {}) {
  const moved = [];
  for (const s of snakes) {
    if (onlyVisible && !s.addedToLayer) continue;
    if (!s.path || s.path.length === 0) continue;
    // dead snakes do not move
    if (s.dead) continue;
    // static snakes never move
    if (s.mode === "static") continue;
    if (s.mode === "bounce") {
      const nextIndex = s.index + s.dir;
      if (nextIndex < 0 || nextIndex >= s.path.length) {
        s.dir = -s.dir;
      }
      s.index += s.dir;
    } else if (s.mode === "loop") {
      s.index = (s.index + 1) % s.path.length;
    } else if (s.mode === "clock") {
      // clockwise loop: always advance forward
      s.index = (s.index + 1) % s.path.length;
    } else if (s.mode === "unclock") {
      // counter-clockwise loop: step backward
      s.index = (s.index - 1 + s.path.length) % s.path.length;
    } else {
      // default fallback: bounce
      const nextIndex = s.index + s.dir;
      if (nextIndex < 0 || nextIndex >= s.path.length) {
        s.dir = -s.dir;
      }
      s.index += s.dir;
    }
    const pos = s.path[s.index];
    try {
      if (s.sprite) {
        s.sprite.gridX = pos.x;
        s.sprite.gridY = pos.y;
        s.sprite.updatePixelPosition();
      }
    } catch (e) {}
    moved.push({ id: s.id, x: pos.x, y: pos.y, floor: s.floor });
  }
  return moved;
}

export function getSnakeAt(x, y, f) {
  for (const s of snakes) {
    // ignore dead snakes for collision / sight checks
    if (s.dead) continue;
    if (!s.path || s.path.length === 0) continue;
    const pos = s.path && s.path[s.index];
    if (!pos) continue;
    if (pos.x === x && pos.y === y && s.floor === f) return true;
    // also check if any other path point equals (x,y) in case sprite hasn't moved yet
    // (not strictly necessary but conservative)
    //if (s.path.some(p => p.x===x && p.y===y) && s.floor===f) return true;
  }
  return false;
}

export function getSnakes() {
  return snakes.map((s) => ({
    id: s.id,
    floor: s.floor,
    path: s.path.slice(),
    index: s.index,
    mode: s.mode,
  }));
}

export function reset() {
  try {
    if (_floorListener) off("floorChanged", _floorListener);
  } catch (e) {}
  try {
    for (const s of snakes) {
      try {
        if (
          s.addedToLayer &&
          s.sprite &&
          _appLayers &&
          _appLayers.entityLayer
        ) {
          _appLayers.entityLayer.removeChild(s.sprite.sprite);
        }
      } catch (e) {}
    }
  } catch (e) {}
  snakes = [];
  _nextId = 1;
  _appLayers = null;
  _floorListener = null;
  _assetsLoaded = false;
}

export function resetPositions() {
  try {
    for (const s of snakes) {
      if (!s.path || s.path.length === 0) continue;
      s.index = typeof s.initialIndex === "number" ? s.initialIndex : 0;
      s.dir = -1;
      const pos = s.path[s.index];
      try {
        if (s.sprite) {
          s.sprite.gridX = pos.x;
          s.sprite.gridY = pos.y;
          s.sprite.updatePixelPosition();
        }
      } catch (e) {}
    }
  } catch (e) {}
}

// Mark any snake currently occupying (x,y,floor) as dead. Dead snakes stop moving,
// show a dead sprite and are ignored for petrification/collision checks. Returns
// array of killed snake ids or null if none.
export function killSnakeAt(x, y, floor) {
  const killed = [];
  for (const s of snakes) {
    if (s.floor !== floor) continue;
    if (s.dead) continue;
    try {
      const pos = s.path && s.path[s.index];
      if (!pos) continue;
      if (pos.x === x && pos.y === y) {
        s.dead = true;
        // For static (map) snakes, clear the underlying map tile so the
        // dead snake no longer causes petrification via tile checks.
        try {
          if (s.mode === "static") {
            try {
              mapService.setTile(pos.x, pos.y, 0, s.floor);
            } catch (e) {}
          }
        } catch (e) {}
        // change visual to dead sprite but keep GameObject so it remains visible
        try {
          if (s.sprite && s.sprite.sprite) {
            s.sprite.sprite.texture = PIXI.Texture.from("img/snake_dead.png");
          }
        } catch (e) {}
        killed.push(s.id);
      }
    } catch (e) {}
  }
  return killed.length ? killed : null;
}
