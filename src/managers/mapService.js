import {
  mapData as INITIAL_MAP,
  ORIGINAL_MAP,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE,
} from "../core/constants.js";

let mapData = INITIAL_MAP.map((r) => r.slice());

export function getTile(x, y) {
  return mapData[y] && mapData[y][x];
}
export function setTile(x, y, val) {
  if (mapData[y]) mapData[y][x] = val;
}
export function resetMap() {
  mapData = ORIGINAL_MAP.map((r) => r.slice());
}
export function getWidth() {
  return MAP_WIDTH;
}
export function getHeight() {
  return MAP_HEIGHT;
}

export function onFall() {
  // simple behavior: reset map and notify via console for now
  console.log("player fell into hole");
  resetMap();
}
