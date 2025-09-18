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

function makeGameObjectForSnake(snakeDef) {
  // use red snake image for 'unclock' mode, default otherwise
  const imgPath =
    snakeDef && snakeDef.mode === "unclock"
      ? "img/snake_red.png"
      : "img/snake.png";
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
      // preload both normal and red snake images
      await loadAssets(["img/snake.png", "img/snake_red.png"]);
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
          continue; // skip auto-detection for this floor
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

  // ensure we toggle sprite visibility on floor change
  try {
    if (_floorListener) off("floorChanged", _floorListener);
  } catch (e) {}
  _floorListener = (f) => {
    try {
      for (const s of snakes) {
        if (!s.sprite) continue;
        if (f === s.floor) {
          if (s.addedToLayer) continue;
          try {
            _appLayers.entityLayer.addChild(s.sprite.sprite);
          } catch (e) {}
          s.addedToLayer = true;
        } else {
          if (!s.addedToLayer) continue;
          try {
            _appLayers.entityLayer.removeChild(s.sprite.sprite);
          } catch (e) {}
          s.addedToLayer = false;
        }
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
    mode, // 'bounce' or 'loop' (future extension)
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
    // only add to layer if current floor matches
    try {
      if (
        _appLayers &&
        _appLayers.entityLayer &&
        mapService.getFloor() === floor
      ) {
        _appLayers.entityLayer.addChild(snakeDef.sprite.sprite);
        snakeDef.addedToLayer = true;
      }
    } catch (e) {}
  } catch (e) {}
  snakes.push(snakeDef);
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
    const pos = s.path[s.index];
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
