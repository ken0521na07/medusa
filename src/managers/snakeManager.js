import GameObject from "../entities/gameObject.js";
import { TILE, MAP_WIDTH, MAP_HEIGHT, MAPS } from "../core/constants.js";
import * as mapService from "./mapService.js";
import { loadAssets } from "../core/assets.js";
import { on, off } from "../core/eventBus.js";

let snakes = []; // array of { id, floor, path, index, dir, mode, sprite, addedToLayer }
let _nextId = 1;
let _appLayers = null;
let _floorListener = null;
let _assetsLoaded = false;

function makeGameObjectForSnake(snakeDef) {
  const g = new GameObject(
    snakeDef.path[snakeDef.index].x,
    snakeDef.path[snakeDef.index].y,
    "img/snake.png"
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
      await loadAssets(["img/snake.png"]);
      _assetsLoaded = true;
    } catch (e) {}
  }

  // auto-detect snake paths from MAPS if requested
  if (autoFromMap) {
    // iterate through floors defined in MAPS
    const floors = Object.keys(MAPS).map((k) => parseInt(k, 10));
    for (const f of floors) {
      const points = new Set();
      const starts = new Set();
      const w = mapService.getWidth();
      const h = mapService.getHeight();
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = mapService.getTile(x, y, f);
          if (t === TILE.SNAKE_BOUNCE || t === "snake_bounce") {
            points.add(x + "," + y);
          }
          if (t === TILE.SNAKE_BOUNCE_START || t === "snake_bounce_start") {
            // treat start marker also as part of the path
            points.add(x + "," + y);
            starts.add(x + "," + y);
          }
          // detect clock-style snake loop tiles
          if (t === TILE.SNAKE_CLOCK || t === "snake_clock") {
            points.add(x + "," + y);
          }
          if (t === TILE.SNAKE_CLOCK_START || t === "snake_clock_start") {
            points.add(x + "," + y);
            starts.add(x + "," + y);
          }
        }
      }
      if (points.size === 0) continue;
      // group connected components (each becomes one snake path)
      const comps = findConnectedComponents(points);
      for (const comp of comps) {
        // determine if this component contains any clock tiles by checking map
        const hasClock = comp.some((p) => {
          const tt = mapService.getTile(p.x, p.y, f);
          return (
            tt === TILE.SNAKE_CLOCK ||
            tt === "snake_clock" ||
            tt === TILE.SNAKE_CLOCK_START ||
            tt === "snake_clock_start"
          );
        });
        if (hasClock) {
          // compute centroid
          const cx = comp.reduce((s, p) => s + p.x, 0) / comp.length;
          const cy = comp.reduce((s, p) => s + p.y, 0) / comp.length;
          // sort points by angle around centroid to get clockwise order (atan2 gives CCW from +x; we'll invert for clockwise)
          comp.sort((a, b) => {
            const aa = Math.atan2(a.y - cy, a.x - cx);
            const ab = Math.atan2(b.y - cy, b.x - cx);
            return aa - ab; // ascending raw atan2 gives desired clockwise order on grid
          });
          // choose starting index if any point in this comp was marked as start
          let startIndex = 0;
          for (let i = 0; i < comp.length; i++) {
            const key = comp[i].x + "," + comp[i].y;
            if (starts.has(key)) {
              startIndex = i;
              break;
            }
          }
          addSnake({ floor: f, path: comp, mode: "clock", startIndex });
        } else {
          // sort comp for a predictable path order: prefer top-to-bottom then left-to-right
          comp.sort((a, b) => a.y - b.y || a.x - b.x);
          // choose starting index if any point in this comp was marked as start
          let startIndex = 0;
          for (let i = 0; i < comp.length; i++) {
            const key = comp[i].x + "," + comp[i].y;
            if (starts.has(key)) {
              startIndex = i;
              break;
            }
          }
          addSnake({ floor: f, path: comp, mode: "bounce", startIndex });
        }
      }
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
