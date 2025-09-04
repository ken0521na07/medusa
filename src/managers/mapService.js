import {
  MAPS as INITIAL_MAPS,
  ORIGINAL_MAPS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE,
  MAP_IMAGES,
} from "../core/constants.js";

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

export function onFall() {
  // simple behavior: reset current floor map and notify via console for now
  console.log("player fell into hole on floor", currentFloor);
  resetMap(currentFloor);
}
