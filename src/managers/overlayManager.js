import * as mapService from "./mapService.js";
import { on } from "../core/eventBus.js";
import { ORIGINAL_MAPS, allInfo, allPuzzles } from "../core/constants.js";

// Lightweight overlay & torch manager extracted from uiSetup to reduce file size.
// Keeps the same global shapes (window.__torches, window.__overlays) so other
// modules that read those globals continue to work.

export function initOverlayManager({ app, TILE } = {}) {
  // ensure global containers exist
  window.__torches = window.__torches || {};
  window.__overlays = window.__overlays || {};

  const TILE_SIZE =
    typeof window !== "undefined" && window.TILE_SIZE ? window.TILE_SIZE : 40;

  function _overlayKey(x, y, f) {
    return `${x},${y},${f}`;
  }

  function placeTorchAt(x, y, f, isCorrect) {
    try {
      const key = _overlayKey(x, y, f);
      if (window.__torches[key]) return false;
      const img = isCorrect ? "img/torch_on.jpg" : "img/torch_off.jpg";
      const spr = PIXI.Sprite.from(img);
      try {
        spr.width = TILE_SIZE;
        spr.height = TILE_SIZE;
      } catch (e) {}
      spr.x = x * TILE_SIZE;
      spr.y = y * TILE_SIZE;
      try {
        const currentFloor = mapService.getFloor();
        spr.visible = f === currentFloor;
      } catch (e) {
        spr.visible = false;
      }
      try {
        if (app && app._layers && app._layers.mapLayer) {
          app._layers.mapLayer.addChild(spr);
        } else if (app && app.stage) {
          app.stage.addChildAt(spr, 0);
        }
      } catch (e) {}
      window.__torches[key] = {
        x,
        y,
        floor: f,
        sprite: spr,
        isCorrect: !!isCorrect,
      };
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeTorchAt(x, y, f) {
    try {
      const key = _overlayKey(x, y, f);
      const entry = window.__torches[key];
      if (!entry) return false;
      try {
        if (entry.sprite && entry.sprite.parent)
          entry.sprite.parent.removeChild(entry.sprite);
      } catch (e) {}
      delete window.__torches[key];
      return true;
    } catch (e) {
      return false;
    }
  }

  function _removeOverlayKey(k) {
    try {
      const entry = window.__overlays[k];
      if (!entry) return;
      if (entry.sprite && entry.sprite.parent)
        entry.sprite.parent.removeChild(entry.sprite);
    } catch (e) {}
    try {
      delete window.__overlays[k];
    } catch (e) {}
  }

  function _refreshOverlayAt(x, y, f, currentFloorView) {
    try {
      const tile = mapService.getTile(x, y, f);
      const key = _overlayKey(x, y, f);
      const boxKeys = [
        TILE.BOX_1F,
        TILE.BOX_3F,
        TILE.BOX_CUSHION,
        TILE.BOX_CHANGE,
      ];
      const puzzleKeys = [
        TILE.PUZZLE_1H,
        TILE.PUZZLE_1S,
        TILE.PUZZLE_1C,
        TILE.PUZZLE_1D,
        TILE.PUZZLE_2H,
        TILE.PUZZLE_2S,
        TILE.PUZZLE_2C,
        TILE.PUZZLE_2D,
        TILE.PUZZLE_3,
        TILE.PUZZLE_4H,
        TILE.PUZZLE_4D,
        TILE.PUZZLE_4S,
        TILE.PUZZLE_4C,
        TILE.PUZZLE_5,
        TILE.PUZZLE_B1,
      ];

      // original map lookup to support overlays when runtime tile removed
      let origTile = null;
      try {
        const om = ORIGINAL_MAPS || window.ORIGINAL_MAPS || {};
        const floorMap = om[f] || om[String(f)];
        if (
          Array.isArray(floorMap) &&
          floorMap[y] &&
          typeof floorMap[y][x] !== "undefined"
        ) {
          origTile = floorMap[y][x];
        }
      } catch (e) {
        origTile = null;
      }
      const isOrigPuzzle = origTile && puzzleKeys.includes(origTile);
      const isOrigBox = origTile && boxKeys.includes(origTile);

      // Allow medusa (and other single-tile overlays) to proceed; avoid early-return
      if (
        !tile ||
        !(
          boxKeys.includes(tile) ||
          puzzleKeys.includes(tile) ||
          tile === TILE.MEDUSA ||
          tile === "medusa"
        )
      ) {
        // if no runtime tile but original map had a puzzle or box and set unlocked, we may still want overlay
        if (!isOrigPuzzle && !isOrigBox) {
          _removeOverlayKey(key);
          return;
        }
      }

      let imgPath = null;

      // medusa tile: show medusa image when runtime or original map contains it
      try {
        if (
          tile === TILE.MEDUSA ||
          tile === "medusa" ||
          origTile === TILE.MEDUSA ||
          origTile === "medusa"
        ) {
          imgPath = "img/medusa.png";
        }
      } catch (e) {}

      if (boxKeys.includes(tile)) {
        const infoKey = typeof tile === "string" ? tile : null;
        const info = infoKey && allInfo[infoKey] ? allInfo[infoKey] : null;
        const opened = info && info.unlocked;
        imgPath = opened ? "img/box_opened.png" : "img/box.png";
      }

      // If runtime tile missing but original map had a box, show opened/closed based on allInfo
      if (!imgPath && isOrigBox) {
        try {
          const infoKey = typeof origTile === "string" ? origTile : null;
          const info = infoKey && allInfo[infoKey] ? allInfo[infoKey] : null;
          const opened = info && info.unlocked;
          imgPath = opened ? "img/box_opened.png" : "img/box.png";
        } catch (e) {
          imgPath = "img/box.png";
        }
      }

      if (puzzleKeys.includes(tile)) {
        const singleMap = {
          [TILE.PUZZLE_1H]: "heart",
          [TILE.PUZZLE_1S]: "spade",
          [TILE.PUZZLE_1C]: "clover",
          [TILE.PUZZLE_1D]: "diamond",
          [TILE.PUZZLE_2H]: "heart",
          [TILE.PUZZLE_2S]: "spade",
          [TILE.PUZZLE_2C]: "clover",
          [TILE.PUZZLE_2D]: "diamond",
          [TILE.PUZZLE_4H]: "heart",
          [TILE.PUZZLE_4D]: "diamond",
          [TILE.PUZZLE_4S]: "spade",
          [TILE.PUZZLE_4C]: "clover",
        };
        if (singleMap[tile]) imgPath = `img/${singleMap[tile]}.png`;
        else imgPath = "img/puzzle.png";
      }

      // If original had a puzzle but runtime tile removed, show overlay only if that piece/set is still locked
      if (!imgPath && isOrigPuzzle) {
        try {
          // map origTile string to puzzle set id
          let setId = null;
          const ot = String(origTile || "").toLowerCase();
          if (ot.indexOf("puzzle_1") === 0) setId = "elevator_1f";
          else if (ot.indexOf("puzzle_2") === 0) setId = "elevator_2f";
          else if (ot.indexOf("puzzle_4") === 0) setId = "elevator_4f";
          else if (ot.indexOf("puzzle_3") === 0) setId = "elevator_3f";
          else if (ot.indexOf("puzzle_5") === 0) setId = "elevator_5f";
          else if (
            ot.indexOf("puzzle_b1") === 0 ||
            ot.indexOf("puzzle_b1") !== -1
          )
            setId = "elevator_b1";

          let shouldShow = true;
          if (setId && allPuzzles && allPuzzles[setId]) {
            const set = allPuzzles[setId];
            // set-based puzzles (3f,5f,b1) use set.unlocked
            if (
              ot === "puzzle_3" ||
              ot === "puzzle_5" ||
              ot.indexOf("puzzle_b1") === 0
            ) {
              if (set.unlocked) shouldShow = false;
              if (Array.isArray(set.bottomImages) && set.bottomImages.length) {
                // no-op, keep behavior
              }
            } else {
              // single-piece: find specific piece by matching id
              const found = (set.pieces || []).find(
                (p) => String(p.id) === String(origTile)
              );
              if (found && found.unlocked) shouldShow = false;
            }
          }

          if (shouldShow) {
            const singleMap = {
              [TILE.PUZZLE_1H]: "heart",
              [TILE.PUZZLE_1S]: "spade",
              [TILE.PUZZLE_1C]: "clover",
              [TILE.PUZZLE_1D]: "diamond",
              [TILE.PUZZLE_2H]: "heart",
              [TILE.PUZZLE_2S]: "spade",
              [TILE.PUZZLE_2C]: "clover",
              [TILE.PUZZLE_2D]: "diamond",
              [TILE.PUZZLE_4H]: "heart",
              [TILE.PUZZLE_4D]: "diamond",
              [TILE.PUZZLE_4S]: "spade",
              [TILE.PUZZLE_4C]: "clover",
            };
            if (singleMap[origTile]) imgPath = `img/${singleMap[origTile]}.png`;
            else imgPath = "img/puzzle.png";
          } else {
            imgPath = null; // do not show if unlocked
          }
        } catch (e) {
          imgPath = "img/puzzle.png";
        }
      }

      if (!imgPath) {
        _removeOverlayKey(key);
        return;
      }

      let entry = window.__overlays[key];
      if (!entry || !entry.sprite) {
        const spr = PIXI.Sprite.from(imgPath);
        try {
          spr.width = TILE_SIZE;
          spr.height = TILE_SIZE;
        } catch (e) {}
        spr.x = x * TILE_SIZE;
        spr.y = y * TILE_SIZE;
        try {
          spr.visible =
            f ===
            (typeof currentFloorView === "number"
              ? currentFloorView
              : mapService.getFloor());
        } catch (e) {
          spr.visible = true;
        }
        try {
          if (app && app._layers && app._layers.mapLayer)
            app._layers.mapLayer.addChild(spr);
          else if (app && app.stage) app.stage.addChildAt(spr, 0);
        } catch (e) {}
        window.__overlays[key] = { x, y, floor: f, sprite: spr, img: imgPath };
      } else {
        try {
          if (entry.img !== imgPath)
            entry.sprite.texture = PIXI.Texture.from(imgPath);
          entry.img = imgPath;
          entry.sprite.x = x * TILE_SIZE;
          entry.sprite.y = y * TILE_SIZE;
          // ensure sprite is attached to mapLayer (recreate/add if parent missing)
          try {
            if (!entry.sprite.parent) {
              if (app && app._layers && app._layers.mapLayer) {
                app._layers.mapLayer.addChild(entry.sprite);
              } else if (app && app.stage) {
                app.stage.addChildAt(entry.sprite, 0);
              }
            }
          } catch (e) {}
          entry.sprite.visible =
            f ===
            (typeof currentFloorView === "number"
              ? currentFloorView
              : mapService.getFloor());
        } catch (e) {}
      }
    } catch (e) {}
  }

  function refreshOverlaysForFloor(f) {
    try {
      const w = mapService.getWidth();
      const h = mapService.getHeight();
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          try {
            _refreshOverlayAt(xx, yy, f, f);
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // Attach event listeners to keep overlays/torches in sync
  try {
    on("floorChanged", (newFloor) => {
      try {
        const overlays = window.__overlays || {};
        for (const k of Object.keys(overlays)) {
          try {
            const e = overlays[k];
            if (e && e.sprite) e.sprite.visible = e.floor === newFloor;
          } catch (e) {}
        }

        // ensure torches visibility also updates when floor changes
        try {
          const torches = window.__torches || {};
          for (const tk of Object.keys(torches)) {
            try {
              const t = torches[tk];
              if (t && t.sprite) t.sprite.visible = t.floor === newFloor;
            } catch (e) {}
          }
        } catch (e) {}

        refreshOverlaysForFloor(newFloor);
      } catch (e) {}
    });
  } catch (e) {}

  try {
    on("puzzleChanged", () => {
      try {
        refreshOverlaysForFloor(mapService.getFloor());
      } catch (e) {}
    });
  } catch (e) {}

  try {
    on("playerMoved", () => {
      try {
        refreshOverlaysForFloor(mapService.getFloor());
      } catch (e) {}
    });
  } catch (e) {}

  // initial refresh so persisted allInfo state is applied
  try {
    refreshOverlaysForFloor(mapService.getFloor());
  } catch (e) {}

  // ensure torches visibility is correct on init
  try {
    const cur = mapService.getFloor();
    const torches = window.__torches || {};
    for (const tk of Object.keys(torches)) {
      try {
        const t = torches[tk];
        if (t && t.sprite) t.sprite.visible = t.floor === cur;
      } catch (e) {}
    }
  } catch (e) {}

  const manager = {
    placeTorchAt,
    removeTorchAt,
    refreshOverlaysForFloor,
    _refreshOverlayAt,
  };

  // expose on window so other modules can call targeted refreshes when needed
  try {
    window.__overlayManager = manager;
  } catch (e) {}

  return manager;
}
