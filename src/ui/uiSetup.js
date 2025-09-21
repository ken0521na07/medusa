import {
  handleGetPuzzlePiece,
  handleGetPuzzleSet,
  renderPuzzleSetList,
} from "../managers/puzzleManager.js";
import {
  openInfoModal,
  closeInfoModal,
  showInfoDetail,
  initInfoModalHandlers,
  renderMagicList,
  renderInfoList, // added to allow refreshing the info list
} from "../managers/infoManager.js";
import { openPuzzleModal, showCustomAlert, showConfirm } from "../ui/modals.js";
import {
  TILE,
  allInfo,
  START_FLOOR,
  playerState,
  allPuzzles,
  STATUE_DISPLAY,
  STATUE_BY_FLOOR,
  STATUE_SYNC,
  TILE_SIZE,
  ORIGINAL_MAPS, // added for original tile checks
} from "../core/constants.js";
// import { startTimer as startTimerCore } from "./timer.js";
import Player from "../entities/player.js";
import { initEngine, getApp } from "../core/engine.js";
import { loadAssets } from "../core/assets.js";
import { START_POS_X, START_POS_Y } from "../core/constants.js";
import * as mapService from "../managers/mapService.js";
import { on, emit } from "../core/eventBus.js";
import * as snakeManager from "../managers/snakeManager.js";
import GameObject from "../entities/gameObject.js";
import { MAPS } from "../core/constants.js";
import * as statueManager from "../managers/statueManager.js";
import * as puzzleManager from "../managers/puzzleManager.js";
import * as changeManager from "../managers/changeManager.js";
import * as magicManager from "../managers/magicManager.js";
import { initOverlayManager } from "../managers/overlayManager.js";
import * as stateManager from "../managers/stateManager.js";

export async function setupUI() {
  const app = initEngine();
  // Do NOT expose playerState globally by default (avoid accidental mutation/side-effects)
  // If needed for debugging, use the console to inspect imports or explicitly attach in dev
  /*
  try {
    if (typeof window !== "undefined") {
      window.playerState = playerState;
      // also expose under globalThis for module consoles that reference globalThis
      try {
        globalThis.playerState = playerState;
      } catch (e) {}
      console.log("[debug] exposed playerState on window/globalThis");
    }
  } catch (e) {}
  */
  // overlay manager instance (initialized later after statues are created)
  let overlayMgr = null;
  // ensure mapService is set to the desired start floor before loading the map image
  try {
    mapService.setFloor(START_FLOOR);
  } catch (e) {}
  // preload map, character, and statue images so sprites render immediately
  await loadAssets([
    mapService.getMapImage(),
    "img/character.png",
    "img/statue.png",
    // preload broken statue texture so setting it later is instant
    "img/statue_broken.png",
  ]);
  // create map sprite from explicit start floor image to avoid race with later events
  const mapSprite = PIXI.Sprite.from(mapService.getMapImage(START_FLOOR));
  mapSprite.width = app.screen.width;
  mapSprite.height = app.screen.height;
  app._layers.mapLayer.addChild(mapSprite);

  // initialize snakes after map and layers are ready so visibility sync works
  try {
    await snakeManager.initSnakes(app._layers);
  } catch (e) {}

  // listen for floor change events to update background image and statue visibility
  on("floorChanged", (floor) => {
    try {
      const img = mapService.getMapImage(floor);
      mapSprite.texture = PIXI.Texture.from(img);
      mapSprite.width = app.screen.width;
      mapSprite.height = app.screen.height;
      // toggle statue visibility based on floor
      try {
        for (const s of statues) {
          if (s && s.obj && typeof s.floor !== "undefined") {
            s.obj.sprite.visible = s.floor === floor;
          }
        }
      } catch (e) {}
      // overlay manager will handle torches/overlays visibility
      try {
        if (
          overlayMgr &&
          typeof overlayMgr.refreshOverlaysForFloor === "function"
        )
          overlayMgr.refreshOverlaysForFloor(floor);
      } catch (e) {}
    } catch (e) {}
  });

  const player = new Player(
    START_POS_X,
    START_POS_Y,
    "img/character.png",
    mapService,
    START_FLOOR
  );
  app._layers.entityLayer.addChild(player.sprite);
  // wire player texture direction updates: keep reference on window for debug access
  // player.prepareTextures and sprite updated in Player.move/teleport already
  window.__playerInstance = player;

  try {
    // delegate statue initialization to the manager which also exposes window.__statues
    await statueManager.init(app._layers);
    try {
      window.__statueManager = statueManager;
    } catch (e) {}
    // ensure visibility sync runs now that statues exist
    try {
      emit("floorChanged", mapService.getFloor());
    } catch (e) {}
  } catch (e) {
    console.error("statueManager.init failed", e);
  }

  // initialize overlay/torch manager now that statues and layers exist
  try {
    overlayMgr = initOverlayManager({ app, TILE, allInfo });
  } catch (e) {}

  // Helper: build a minimal save snapshot for localStorage
  function _buildSaveSnapshot() {
    try {
      const snap = {
        playerState: Object.assign({}, playerState),
        // include runtime player and map state so reload restores exact position/floor
        player:
          player && typeof player.serialize === "function"
            ? player.serialize()
            : null,
        map:
          mapService && typeof mapService.serialize === "function"
            ? mapService.serialize()
            : null,
        allInfo: {},
        allPuzzles: {},
        torches: [],
        statues: [],
      };
      try {
        for (const k of Object.keys(allInfo || {})) {
          snap.allInfo[k] = { unlocked: !!allInfo[k].unlocked };
        }
      } catch (e) {}
      try {
        for (const [sid, sset] of Object.entries(allPuzzles || {})) {
          // preserve set.unlocked and per-piece unlocked where present
          snap.allPuzzles[sid] = { unlocked: !!sset.unlocked };
          if (Array.isArray(sset.pieces)) {
            snap.allPuzzles[sid].pieces = (sset.pieces || []).map((p) => ({
              id: p.id,
              unlocked: !!p.unlocked,
            }));
          }
        }
      } catch (e) {}
      try {
        const tor = window.__torches || {};
        for (const k of Object.keys(tor)) {
          const t = tor[k];
          if (!t) continue;
          snap.torches.push({
            x: t.x,
            y: t.y,
            f: t.floor,
            isCorrect: !!t.isCorrect,
          });
        }
      } catch (e) {}
      try {
        const sts = window.__statues || [];
        for (const s of sts) {
          if (!s) continue;
          snap.statues.push({
            nameKey: s.nameKey,
            x: s.x,
            y: s.y,
            floor: s.floor,
            moved: !!s.moved,
            broken: !!s.broken,
            removed: !!s.removed,
          });
        }
      } catch (e) {}
      return snap;
    } catch (e) {
      return null;
    }
  }

  // Helper: save current state to localStorage
  function _persistState() {
    try {
      const snap = _buildSaveSnapshot();
      if (snap && stateManager && typeof stateManager.save === "function") {
        try {
          stateManager.save(snap);
        } catch (e) {}
      }
    } catch (e) {}
  }

  // Debounced scheduler to persist state on common events
  let _saveTimeout = null;
  function _schedulePersist(delay = 150) {
    try {
      if (typeof window !== "undefined" && window.__skipSaving) return;
      if (_saveTimeout) clearTimeout(_saveTimeout);
      _saveTimeout = setTimeout(() => {
        try {
          _persistState();
        } catch (e) {}
        _saveTimeout = null;
      }, delay);
    } catch (e) {}
  }

  // Persist on common events so reload restores latest state
  try {
    on("playerMoved", () => _schedulePersist());
    on("puzzleChanged", () => _schedulePersist());
    on("statueChanged", () => _schedulePersist());
    on("floorChanged", () => _schedulePersist());
  } catch (e) {}

  // Restore saved state (if any) after overlayMgr init
  try {
    if (stateManager && typeof stateManager.load === "function") {
      const saved = stateManager.load();
      if (saved) {
        // 1) restore map state first (so floor/map-dependent restores work)
        try {
          if (
            saved.map &&
            mapService &&
            typeof mapService.deserialize === "function"
          ) {
            try {
              mapService.deserialize(saved.map);
            } catch (e) {
              console.error("mapService.deserialize failed", e);
            }
          }
        } catch (e) {
          console.error("restore: map deserialize failed", e);
        }

        // 2) update visible map and notify listeners
        try {
          const floor = mapService.getFloor();
          const img = mapService.getMapImage(floor);
          mapSprite.texture = PIXI.Texture.from(img);
          mapSprite.width = app.screen.width;
          mapSprite.height = app.screen.height;
          try {
            emit("floorChanged", floor);
          } catch (e) {}
        } catch (e) {
          console.error("restore: updating map sprite failed", e);
        }

        // 3) restore global playerState and runtime player (prefer runtime when available)
        try {
          if (saved.playerState) {
            try {
              Object.assign(playerState, saved.playerState);
            } catch (e) {
              console.error("restore: applying playerState failed", e);
            }
          }
          if (
            saved.player &&
            player &&
            typeof player.deserialize === "function"
          ) {
            try {
              player.deserialize(saved.player);
            } catch (e) {
              console.error("restore: player.deserialize failed", e);
            }
          }
        } catch (e) {
          console.error("restore: player restore failed", e);
        }

        // 4) restore unlocked info entries
        try {
          if (saved.allInfo) {
            for (const k of Object.keys(saved.allInfo || {})) {
              try {
                if (allInfo[k])
                  allInfo[k].unlocked = !!saved.allInfo[k].unlocked;
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error("restore: allInfo failed", e);
        }

        // 5) restore puzzles
        try {
          if (saved.allPuzzles) {
            for (const sid of Object.keys(saved.allPuzzles || {})) {
              try {
                const sdata = saved.allPuzzles[sid];
                if (!sdata) continue;
                if (allPuzzles[sid]) {
                  try {
                    allPuzzles[sid].unlocked = !!sdata.unlocked;
                  } catch (e) {}
                  try {
                    if (
                      Array.isArray(allPuzzles[sid].pieces) &&
                      Array.isArray(sdata.pieces)
                    ) {
                      for (const p of sdata.pieces) {
                        try {
                          const found = (allPuzzles[sid].pieces || []).find(
                            (pp) => String(pp.id) === String(p.id)
                          );
                          if (found) found.unlocked = !!p.unlocked;
                        } catch (e) {}
                      }
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error("restore: allPuzzles failed", e);
        }

        // 6) restore torches
        try {
          if (saved.torches && Array.isArray(saved.torches)) {
            for (const t of saved.torches) {
              try {
                if (!t) continue;
                if (
                  overlayMgr &&
                  typeof overlayMgr.placeTorchAt === "function"
                ) {
                  overlayMgr.placeTorchAt(t.x, t.y, t.f, !!t.isCorrect);
                } else {
                  const key = `${t.x},${t.y},${t.f}`;
                  window.__torches = window.__torches || {};
                  window.__torches[key] = {
                    x: t.x,
                    y: t.y,
                    floor: t.f,
                    isCorrect: !!t.isCorrect,
                    sprite: null,
                  };
                }
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error("restore: torches failed", e);
        }

        // 7) restore statue runtime state minimally
        try {
          if (saved.statues && Array.isArray(saved.statues)) {
            const sts = window.__statues || [];
            for (const s of saved.statues) {
              try {
                if (!s) continue;
                const found = sts.find(
                  (ss) =>
                    ss &&
                    ss.nameKey === s.nameKey &&
                    ss.initialX === s.x &&
                    ss.initialY === s.y
                );
                if (found) {
                  found.x = s.x;
                  found.y = s.y;
                  found.floor = s.floor;
                  found.moved = !!s.moved;
                  found.broken = !!s.broken;
                  found.removed = !!s.removed;
                }
              } catch (e) {}
            }
            try {
              if (
                statueManager &&
                typeof statueManager.syncVisibility === "function"
              )
                statueManager.syncVisibility(mapService.getFloor());
            } catch (e) {}
          }
        } catch (e) {
          console.error("restore: statues failed", e);
        }

        // 8) finally refresh overlays to reflect restored state
        try {
          if (
            overlayMgr &&
            typeof overlayMgr.refreshOverlaysForFloor === "function"
          )
            overlayMgr.refreshOverlaysForFloor(mapService.getFloor());
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error("restore: outer failed", e);
  }

  // expose helper for testing teleports across floors
  window.teleportPlayer = (x, y, floor) => {
    try {
      player.teleport(x, y, floor);
    } catch (e) {
      console.log("teleportPlayer failed", e);
    }
  };

  // setup DOM hooks
  // ensure magic input exists above the three action buttons
  try {
    const topControls = document.querySelector(".top-controls");
    if (topControls) {
      let actionButtons = topControls.querySelector(".action-buttons");
      if (!actionButtons) {
        actionButtons = document.createElement("div");
        actionButtons.className = "action-buttons";
        topControls.appendChild(actionButtons);
      }

      if (!document.getElementById("magic-input-wrap")) {
        const magicWrap = document.createElement("div");
        magicWrap.id = "magic-input-wrap";
        // rely on CSS, but ensure horizontal layout as fallback
        magicWrap.style.display = "flex";
        magicWrap.style.gap = "8px";
        magicWrap.style.alignItems = "center";
        magicWrap.style.padding = "0 8px";

        const magicInputEl = document.createElement("input");
        magicInputEl.id = "magic-input-text";
        magicInputEl.placeholder = "魔法を入力";
        magicInputEl.autocomplete = "off";
        magicInputEl.style.flex = "1 1 auto";

        const magicSubmitEl = document.createElement("button");
        magicSubmitEl.id = "magic-input-submit";
        magicSubmitEl.textContent = "唱える";
        // style the magic submit like other UI buttons
        magicSubmitEl.className = "ui-button";

        magicWrap.appendChild(magicInputEl);
        magicWrap.appendChild(magicSubmitEl);

        topControls.insertBefore(magicWrap, actionButtons);
      }
    }
  } catch (e) {
    // ignore DOM errors in non-browser environments
  }

  // initialize magic UI handlers now that the magic input exists
  try {
    if (
      typeof magicManager !== "undefined" &&
      magicManager &&
      typeof magicManager.init === "function"
    ) {
      try {
        magicManager.init();
      } catch (e) {}
    }
  } catch (e) {}

  // Wire footer buttons to open the info / puzzle / magic modals and ensure handlers
  try {
    // ensure modal list click handlers are attached
    try {
      initInfoModalHandlers();
    } catch (e) {}

    // Info button
    try {
      const infoBtn = document.getElementById("info-btn");
      if (infoBtn) {
        infoBtn.addEventListener("click", () => {
          try {
            const modal = document.getElementById("info-modal");
            const p1 = document.getElementById("info-page-1");
            const p2 = document.getElementById("info-page-2");
            const list = document.getElementById("info-list");
            try {
              if (typeof renderInfoList === "function") renderInfoList(list);
            } catch (e) {}
            try {
              if (typeof openInfoModal === "function")
                openInfoModal(modal, p1, p2, list);
            } catch (e) {}
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Puzzle button
    try {
      const puzzleBtn = document.getElementById("puzzle-btn");
      if (puzzleBtn) {
        puzzleBtn.addEventListener("click", () => {
          try {
            const list = document.getElementById("puzzle-set-list");
            try {
              if (typeof renderPuzzleSetList === "function")
                renderPuzzleSetList(list);
            } catch (e) {}
            try {
              if (typeof openPuzzleModal === "function") openPuzzleModal();
            } catch (e) {}
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Magic / Item button
    try {
      const itemBtn = document.getElementById("item-btn");
      if (itemBtn) {
        itemBtn.addEventListener("click", () => {
          try {
            const modal = document.getElementById("keyword-modal");
            const list = document.getElementById("magic-list");
            try {
              if (typeof renderMagicList === "function") renderMagicList(list);
            } catch (e) {}
            if (modal) modal.style.display = "flex";
          } catch (e) {}
        });
      }
    } catch (e) {}
  } catch (e) {}

  const moveButtons = [
    { id: "up-btn", dx: 0, dy: -1 },
    { id: "down-btn", dx: 0, dy: 1 },
    { id: "left-btn", dx: -1, dy: 0 },
    { id: "right-btn", dx: 1, dy: 0 },
  ];

  let lastMoveTime = 0;
  let suppressClickUntil = 0;
  const POINTER_DEBOUNCE_MS = 40;
  const CLICK_SUPPRESS_MS = 250;

  moveButtons.forEach((b) => {
    const btn = document.getElementById(b.id);
    if (!btn) return;
    // per-button flag to avoid handling both pointerup and click
    let _lastPointerHandledAt = 0;

    const onPointerUp = (e) => {
      const now = Date.now();
      if (now - lastMoveTime < POINTER_DEBOUNCE_MS) return;
      lastMoveTime = now;
      suppressClickUntil = now + CLICK_SUPPRESS_MS;
      _lastPointerHandledAt = now;
      player.move(b.dx, b.dy);
    };
    btn.addEventListener("pointerup", onPointerUp, { passive: false });

    // Keep click handler for keyboard/legacy activation, but ignore click if
    // pointerup just handled the action (prevents double-move).
    btn.addEventListener("click", (e) => {
      const now = Date.now();
      // if pointerup handled this button recently, ignore the click
      if (now - _lastPointerHandledAt < 500) {
        e.preventDefault();
        return;
      }
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        return;
      }
      player.move(b.dx, b.dy);
    });
  });

  // enable keyboard arrow keys for movement (ignore when typing in inputs)
  window.addEventListener("keydown", (e) => {
    try {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return; // don't move player while typing
      }
      const keyMap = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const vec = keyMap[e.key];
      if (!vec) return;
      const now = Date.now();
      if (now - lastMoveTime < POINTER_DEBOUNCE_MS) return;
      if (now < suppressClickUntil) return;
      e.preventDefault();
      lastMoveTime = now;
      suppressClickUntil = now + CLICK_SUPPRESS_MS;
      player.move(vec[0], vec[1]);
    } catch (err) {
      // ignore if player not available
    }
  });

  // Helper to build a unique key for torch positions (used by window.__torches)
  function _torchKey(x, y, f) {
    try {
      if (typeof window !== "undefined")
        window.__torches = window.__torches || {};
      return `${x},${y},${f}`;
    } catch (e) {
      return String(x) + "," + String(y) + "," + String(f);
    }
  }

  function handleActionEvent() {
    if (!player) return;
    // debug: log when action handler is invoked (helps detect keyboard vs UI issues)
    try {
      console.log(
        `[action] handleActionEvent invoked at (${player.gridX},${player.gridY},f=${player.floor}) dir=${player.direction}`
      );
    } catch (e) {}

    // check tile in front of player first for statues
    const dirMap = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
    const vec = dirMap[player.direction] || [0, 0];
    const fx = player.gridX + vec[0];
    const fy = player.gridY + vec[1];
    const frontTile = mapService.getTile(fx, fy, player.floor);

    if (typeof frontTile === "string" && frontTile.startsWith("statue_")) {
      // reveal statue name using STATUE_DISPLAY mapping
      try {
        const nameKey = frontTile; // e.g. 'statue_j'
        const displayName =
          (typeof STATUE_DISPLAY === "object" && STATUE_DISPLAY[nameKey]) ||
          null;
        const msg = displayName
          ? `この像の名前は${displayName}です。`
          : "この像の名前は不明だ。";
        showCustomAlert(msg);
      } catch (e) {
        try {
          showCustomAlert("この像の名前は不明だ。");
        } catch (e2) {}
      }
      return;
    }

    // medusa front interaction: if facing medusa and medusaDefeated flag is true,
    // do not petrify and allow A to 'defeat' medusa when pressed
    try {
      if (
        (frontTile === TILE.MEDUSA || frontTile === "medusa") &&
        playerState &&
        playerState.medusaDefeated
      ) {
        try {
          showCustomAlert("メドゥーサを討伐した！");
        } catch (e) {
          try {
            window.alert("メドゥーサを討伐した！");
          } catch (e2) {}
        }
        return;
      }
    } catch (e) {}

    const x = player.gridX;
    const y = player.gridY;
    const currentTileType = mapService.getTile(x, y);

    // If standing on an info_* tile that exists in allInfo, unlock it (add to info modal list)
    // and show a custom alert. Do NOT open the info modal automatically.
    try {
      // support tile -> infoKey aliases (map uses info_hole but allInfo stores about_hole)
      const INFO_TILE_ALIAS = {
        info_hole: "about_hole",
      };
      const infoKey =
        (typeof currentTileType === "string" &&
          (INFO_TILE_ALIAS[currentTileType] || currentTileType)) ||
        null;
      if (infoKey && allInfo[infoKey]) {
        const info = allInfo[infoKey];
        // only unlock once
        if (!info.unlocked) {
          info.unlocked = true;
          // remove the tile so it can't be picked up again
          try {
            mapService.setTile(x, y, 0);
          } catch (e) {}
          // refresh info list UI if present
          try {
            const listEl = document.getElementById("info-list");
            if (listEl && typeof renderInfoList === "function")
              renderInfoList(listEl);
          } catch (e) {}

          // Special handling for the torch/info_torch tile: grant 6 torches and show custom message
          try {
            if (
              infoKey === "info_torch" ||
              currentTileType === TILE.INFO_TORCH ||
              currentTileType === "info_torch"
            ) {
              try {
                // ensure numeric storage and add explicit logging for debugging
                const prevCount = Number(
                  (playerState && playerState.torchCount) || 0
                );
                const grant = 6;
                playerState.torchCount = prevCount + grant;
                // mark that the player has obtained torches at least once
                try {
                  playerState.gotTorches = true;
                } catch (e) {}
                // debug log: location and torch counts
                try {
                  console.log(
                    `[torch] info_torch picked at (${x},${y},f=${player.floor}) prev=${prevCount} granted=${grant} now=${playerState.torchCount}`
                  );
                } catch (e) {}
              } catch (e) {}

              try {
                showCustomAlert(
                  "メドューサの情報と松明を入手した。Aボタンを押すことでそのますに松明を配置できる"
                );
              } catch (e) {
                try {
                  window.alert(
                    "メドューサの情報と松明を入手した。Aボタンを押すことでそのますに松明を配置できる"
                  );
                } catch (e2) {}
              }
            } else {
              // show pickup alert: "(title)を手に入れた"
              try {
                showCustomAlert((info.title || "情報") + "を手に入れた");
              } catch (e) {
                try {
                  window.alert((info.title || "情報") + "を手に入れた");
                } catch (e2) {}
              }
            }
          } catch (e) {}
        }
        return;
      }
    } catch (e) {}

    // --- restored: handle box_* pickups (box_1f, box_3f, box_cushion, box_change)
    try {
      const boxKeys = [
        TILE.BOX_1F,
        TILE.BOX_3F,
        TILE.BOX_CUSHION,
        TILE.BOX_CHANGE,
      ];
      if (
        typeof currentTileType === "string" &&
        boxKeys.includes(currentTileType)
      ) {
        const key = currentTileType;
        const info = allInfo[key];

        // If this is the change box, ask for confirmation before applying
        if (key === TILE.BOX_CHANGE || key === "box_change") {
          try {
            // show confirmation dialog; on confirm apply pickup and open change modal
            if (typeof showConfirm === "function") {
              showConfirm("チェンジを発動しますか？", {
                onConfirm: () => {
                  try {
                    // mark unlocked
                    if (info && !info.unlocked) info.unlocked = true;
                    // remove tile
                    try {
                      mapService.setTile(x, y, 0);
                    } catch (e) {}
                    // notify and persist
                    try {
                      emit &&
                        typeof emit === "function" &&
                        emit("puzzleChanged");
                    } catch (e) {}
                    try {
                      if (typeof _persistState === "function") _persistState();
                      else if (typeof _schedulePersist === "function")
                        _schedulePersist(0);
                    } catch (e) {}
                    // refresh magic list UI if open
                    try {
                      const list = document.getElementById("magic-list");
                      if (list && typeof renderMagicList === "function")
                        renderMagicList(list);
                    } catch (e) {}
                    // show pickup alert
                    try {
                      const title = info && info.title ? info.title : "魔法";
                      showCustomAlert(title + "を手に入れた");
                    } catch (e) {}
                    // open the change modal
                    try {
                      if (
                        changeManager &&
                        typeof changeManager.openChangeModal === "function"
                      )
                        changeManager.openChangeModal();
                    } catch (e) {}
                  } catch (e) {}
                },
                onCancel: () => {
                  // do nothing if cancelled
                },
              });
            } else {
              // fallback: directly open change modal
              try {
                if (
                  changeManager &&
                  typeof changeManager.openChangeModal === "function"
                )
                  changeManager.openChangeModal();
              } catch (e) {}
            }
          } catch (e) {}
          return;
        }

        // default behavior for other box types: immediate pickup
        // ensure info entry exists and mark unlocked
        if (info && !info.unlocked) info.unlocked = true;
        // remove tile from map
        try {
          mapService.setTile(x, y, 0);
        } catch (e) {}

        // notify listeners so overlays refresh immediately (box -> box_opened)
        try {
          emit && typeof emit === "function" && emit("puzzleChanged");
        } catch (e) {}

        // Immediately persist state so box pickups are not lost if the app
        // is closed before the debounced autosave fires.
        try {
          if (typeof _persistState === "function") _persistState();
        } catch (e) {
          try {
            // fallback: schedule a quick persist
            if (typeof _schedulePersist === "function") _schedulePersist(0);
          } catch (ex) {}
        }

        // special handling: acquiring BOX_3F grants MOVE magic (kept as unlock only)
        try {
          if (key === TILE.BOX_3F || key === "box_3f") {
            // no additional runtime side-effects here; info unlocked above
          }
        } catch (e) {}

        // refresh magic list UI if open
        try {
          const list = document.getElementById("magic-list");
          if (list && typeof renderMagicList === "function")
            renderMagicList(list);
        } catch (e) {}

        // show pickup alert
        try {
          const title = info && info.title ? info.title : "魔法";
          showCustomAlert(title + "を手に入れた");
        } catch (e) {
          try {
            window.alert(
              (info && info.title ? info.title : "魔法") + "を手に入れた"
            );
          } catch (e2) {}
        }
        return;
      }
    } catch (e) {}

    // NEW: handle stepping on a 'change' tile (非箱) to prompt activation
    try {
      if (currentTileType === TILE.CHANGE || currentTileType === "change") {
        try {
          if (typeof showConfirm === "function") {
            showConfirm("チェンジを発動しますか？", {
              onConfirm: () => {
                try {
                  if (
                    changeManager &&
                    typeof changeManager.openChangeModal === "function"
                  )
                    changeManager.openChangeModal();
                } catch (e) {}
              },
              onCancel: () => {},
            });
          } else {
            try {
              if (
                changeManager &&
                typeof changeManager.openChangeModal === "function"
              )
                changeManager.openChangeModal();
            } catch (e) {}
          }
        } catch (e) {}
        return;
      }
    } catch (e) {}

    // --- Torches: place / pick up when standing on floor or torch_correct
    try {
      // debug: log entering torch handling and current playerState for diagnosis
      try {
        console.log(
          `[torch] evaluating at (${x},${y},f=${
            player.floor
          }) currentTileType=${String(
            currentTileType
          )} playerState.torchCount=${Number(
            (playerState && playerState.torchCount) || 0
          )}`
        );
      } catch (e) {}
      // precompute torch key and check for an existing placed torch at this position
      const torchKey = _torchKey(x, y, player.floor);
      const existingTorch = (window.__torches || {})[torchKey];

      // define puzzle tile keys for which we want to defer to puzzle handling when
      // the player has no torches
      const PUZZLE_TILE_KEYS = [
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

      // If player has no torches and there is no torch placed here:
      // - If standing on a puzzle tile -> skip torch logic so puzzle pickup runs
      // - Otherwise -> show guidance that the player has no torches
      const torchCount = Number(playerState.torchCount || 0);
      if (torchCount === 0 && !existingTorch) {
        const isStandingOnPuzzle = PUZZLE_TILE_KEYS.includes(currentTileType);
        if (isStandingOnPuzzle) {
          // do nothing and allow subsequent puzzle handling to run
        } else {
          try {
            if (playerState && playerState.gotTorches) {
              // player obtained torches before but currently has 0
              showCustomAlert(
                "もう松明を持っていない、すでに置いてある松明の上でAボタンを押すことで回収できる"
              );
            }
          } catch (e) {}
          return;
        }
      } else {
        // existing handling: if a torch is already placed here, A picks it up
        if (existingTorch) {
          const removed = overlayMgr
            ? overlayMgr.removeTorchAt(x, y, player.floor)
            : false;
          if (removed) {
            try {
              playerState.torchCount = (playerState.torchCount || 0) + 1;
            } catch (e) {}
            try {
              showCustomAlert("松明を回収した");
            } catch (e) {}
          }
          return;
        }

        // Explicitly check the tile at the player's current floor/position
        const tileAtPos = mapService.getTile(x, y, player.floor);
        // Strict checks: only numeric 0 (floor) or explicit TORCH_CORRECT string are allowed
        const isFloor = tileAtPos === 0 || tileAtPos === TILE.FLOOR;
        const isCorrect =
          tileAtPos === TILE.TORCH_CORRECT || tileAtPos === "torch_correct";

        // Helper: map a tile value to TILE key name for logging
        const getTileKeyName = (val) => {
          try {
            for (const k of Object.keys(TILE)) {
              if (TILE[k] === val) return k;
            }
            // handle numeric 0 explicitly
            if (val === 0) return "FLOOR";
            if (typeof val === "string") return val.toUpperCase();
          } catch (e) {}
          return String(val);
        };

        // Determine original map tile at this location (based on ORIGINAL_MAPS)
        let origTile = null;
        try {
          const om = ORIGINAL_MAPS || {};
          const floorMap = om[player.floor] || om[String(player.floor)];
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

        // Log current and original tile types for debugging when attempting to place
        try {
          console.log(
            `[torch] attempt at (${x},${y},f=${
              player.floor
            }) current=${getTileKeyName(tileAtPos)} original=${getTileKeyName(
              origTile
            )}`
          );
        } catch (e) {}

        // Disallow placement if the original map tile wasn't FLOOR (0) or TORCH_CORRECT
        const origIsFloor = origTile === 0 || origTile === TILE.FLOOR;
        const origIsCorrect =
          origTile === TILE.TORCH_CORRECT || origTile === "torch_correct";
        if (!origIsFloor && !origIsCorrect) {
          try {
            showCustomAlert("そこには松明は置けない");
          } catch (e) {}
          return;
        }

        // If tile not floor/torch_correct at runtime: cannot place
        if (!isFloor && !isCorrect) {
          try {
            showCustomAlert("そこには松明は置けない");
          } catch (e) {}
          return;
        }

        // Tile is valid for placement: attempt to place if the player has torches
        if ((playerState.torchCount || 0) > 0) {
          const ok = overlayMgr
            ? overlayMgr.placeTorchAt(x, y, player.floor, !!isCorrect)
            : false;
          if (ok) {
            try {
              playerState.torchCount = Math.max(
                0,
                (playerState.torchCount || 0) - 1
              );
            } catch (e) {}
            try {
              showCustomAlert("松明を設置した");
            } catch (e) {}

            // after placing, check win condition: 6 torches all on torch_correct tiles
            try {
              let correctCount = 0;
              for (const k of Object.keys(window.__torches || {})) {
                const t = window.__torches[k];
                if (t && t.isCorrect) correctCount++;
              }
              if (correctCount >= 6) {
                try {
                  // disable medusa petrification so warping to 6F is safe
                  try {
                    if (playerState) playerState.medusaDefeated = true;
                    try {
                      console.log(
                        "[torch] medusa disabled (medusaDefeated=true)"
                      );
                    } catch (e) {}
                  } catch (e) {}

                  // warp player to (5,1,6)
                  player.teleport(5, 1, 6);
                  showCustomAlert(
                    "石化が無効化され、メデューサを討伐する準備が整った。"
                  );
                } catch (e) {}
              }
            } catch (e) {}
          }
        } else {
          // Player has no torches to place — show helpful guidance
          try {
            showCustomAlert(
              "もう松明を持っていない、すでに置いてある松明の上でAボタンを押すことで回収できる"
            );
          } catch (e) {}
        }
        return;
      }
    } catch (e) {}

    switch (currentTileType) {
      // 1F/2F: single-suit pieces -> delegate to handleGetPuzzlePiece
      case TILE.PUZZLE_1H:
      case TILE.PUZZLE_1S:
      case TILE.PUZZLE_1C:
      case TILE.PUZZLE_1D:
      case TILE.PUZZLE_2H:
      case TILE.PUZZLE_2S:
      case TILE.PUZZLE_2C:
      case TILE.PUZZLE_2D:
        try {
          handleGetPuzzlePiece(
            "elevator_" + (player.floor === 2 ? "2f" : "1f"),
            currentTileType,
            { x, y, floor: player.floor }
          );
        } catch (e) {
          console.error("failed to handle 1F/2F puzzle piece pickup", e);
        }
        break;

      // 3F: set unlock
      case TILE.PUZZLE_3:
        try {
          handleGetPuzzleSet("elevator_3f", { x, y, floor: player.floor });
        } catch (e) {
          console.error("failed to handle 3F puzzle set pickup", e);
        }
        break;

      // 4F: single-suit pieces -> delegate to handleGetPuzzlePiece
      case TILE.PUZZLE_4H:
      case TILE.PUZZLE_4D:
      case TILE.PUZZLE_4S:
      case TILE.PUZZLE_4C:
        try {
          handleGetPuzzlePiece("elevator_4f", currentTileType, {
            x,
            y,
            floor: player.floor,
          });
        } catch (e) {
          console.error("failed to handle 4F puzzle piece pickup", e);
        }
        break;

      // 5F: set unlock
      case TILE.PUZZLE_5:
        try {
          handleGetPuzzleSet("elevator_5f", { x, y, floor: player.floor });
        } catch (e) {
          console.error("failed to handle 5F puzzle set pickup", e);
        }
        break;

      // B1F: set unlock
      case TILE.PUZZLE_B1:
        try {
          handleGetPuzzleSet("elevator_b1", { x, y, floor: player.floor });
        } catch (e) {
          console.error("failed to handle B1 puzzle set pickup", e);
        }
        break;

      default:
        break;
    }
  }

  // action A button: handle interactions with tiles (info, puzzles, boxes, etc.)
  const actionA = document.getElementById("action-a-btn");
  if (actionA) {
    let _lastActionAAt = 0;
    const ACTION_A_DEBOUNCE_MS = 150;
    // support touch/pointer devices and fallback click
    actionA.addEventListener(
      "pointerup",
      (e) => {
        try {
          e.preventDefault();
        } catch (err) {}
        try {
          const now = Date.now();
          if (now - _lastActionAAt < ACTION_A_DEBOUNCE_MS) return;
          _lastActionAAt = now;
          handleActionEvent();
        } catch (err) {}
      },
      { passive: false }
    );
    actionA.addEventListener("click", (e) => {
      try {
        e.preventDefault();
      } catch (err) {}
      try {
        const now = Date.now();
        if (now - _lastActionAAt < ACTION_A_DEBOUNCE_MS) return;
        _lastActionAAt = now;
        handleActionEvent();
      } catch (err) {}
    });

    // Bind keyboard 'A' key to trigger actionA for desktop users
    try {
      window.addEventListener("keydown", (e) => {
        try {
          const active = document.activeElement;
          if (
            active &&
            (active.tagName === "INPUT" ||
              active.tagName === "TEXTAREA" ||
              active.isContentEditable)
          ) {
            return; // don't trigger while typing
          }
          if (e.key === "a" || e.key === "A") {
            const now = Date.now();
            if (now - _lastActionAAt < ACTION_A_DEBOUNCE_MS) return;
            _lastActionAAt = now;
            e.preventDefault();
            handleActionEvent();
          }
        } catch (err) {}
      });
    } catch (e) {}
  } else {
    // ...existing code...
  }
}

export function startTimer() {
  let seconds = 0;
  const timerElement = document.getElementById("timer");
  setInterval(() => {
    seconds++;
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (seconds % 60).toString().padStart(2, "0");
    try {
      if (timerElement) timerElement.textContent = `TIME ${min}:${sec}`;
    } catch (e) {}
  }, 1000);
}

// Create move modal UI on demand
function openMoveModal() {
  const statues =
    typeof window !== "undefined" && window.__statues ? window.__statues : [];
  let modal = document.getElementById("move-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "move-modal";
    modal.className = "modal-wrapper";
    modal.style.display = "flex";
    modal.style.position = "fixed";
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.width = "100%";
    modal.style.height = "100%";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = 25000;

    const box = document.createElement("div");
    box.className = "modal-content";
    box.style.padding = "12px";
    box.style.background = "#fff";
    box.style.borderRadius = "6px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    box.style.minWidth = "240px";

    const p1 = document.createElement("div");
    p1.textContent = "ムーブを使用する像の名前を入力してください";
    box.appendChild(p1);

    const nameInput = document.createElement("input");
    nameInput.placeholder = "像の名前";
    nameInput.id = "move-name-input";
    box.appendChild(nameInput);

    const p2 = document.createElement("div");
    p2.textContent = "像を動かす方向を入力してください";
    box.appendChild(p2);

    const select = document.createElement("select");
    select.id = "move-direction-select";
    ["東", "西", "南", "北"].forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });
    box.appendChild(select);

    const submit = document.createElement("button");
    submit.textContent = "送信";
    box.appendChild(submit);

    const close = document.createElement("button");
    close.textContent = "閉じる";
    box.appendChild(close);

    modal.appendChild(box);
    document.body.appendChild(modal);

    // handlers
    close.addEventListener("click", () => {
      modal.style.display = "none";
    });
    submit.addEventListener("click", () => {
      const name = (nameInput.value || "").trim();
      const dir = select.value;

      // map input name to internal statue key
      const nameKey = Object.keys(STATUE_DISPLAY).find(
        (k) => STATUE_DISPLAY[k] === name
      );
      if (!nameKey) {
        modal.style.display = "none";
        showCustomAlert("その像は見つからないようだ");
        return;
      }

      // find all statue instances matching this nameKey
      const targets = statues.filter((st) => st.nameKey === nameKey);
      if (!targets || targets.length === 0) {
        modal.style.display = "none";
        showCustomAlert("その像は見つからないようだ");
        return;
      }

      // helper to get direction vector for a given floor (accounts for orientation)
      const getVecForFloor = (d, floor) => {
        // default: screen-up is north
        if (floor === 5) {
          // screen left is north (up is east)
          // 北: left, 東: up, 南: right, 西: down
          if (d === "北") return [-1, 0];
          if (d === "東") return [0, -1];
          if (d === "南") return [1, 0];
          if (d === "西") return [0, 1];
        } else {
          // floors 3,4,6 and most others: up is north
          if (d === "北") return [0, -1];
          if (d === "東") return [1, 0];
          if (d === "南") return [0, 1];
          if (d === "西") return [-1, 0];
        }
        return null;
      };

      // special-case: statue_m moves together between 6F and 2F
      const handleStatueM = () => {
        // find both instances (2F and 6F)
        const s2 = statues.find(
          (st) => st.nameKey === "statue_m" && st.floor === 2
        );
        const s6 = statues.find(
          (st) => st.nameKey === "statue_m" && st.floor === 6
        );
        // require north when either instance exists (2F can only move north)
        if (dir !== "北") {
          modal.style.display = "none";
          showCustomAlert("その像は北にしか動かせないようだ");
          return false;
        }

        // If 2F instance exists, move it using special mapping to (3,2)
        if (s2) {
          // validate there is indeed an instance at expected origin
          if (s2.x !== 7 || s2.y !== 5) {
            modal.style.display = "none";
            showCustomAlert("その像は動かせないようだ");
            return false;
          }
          try {
            mapService.setTile(s2.x, s2.y, 0, s2.floor);
            mapService.setTile(3, 2, "statue_m", 2);
            s2.x = 3;
            s2.y = 2;
            s2.obj.gridX = 3;
            s2.obj.gridY = 2;
            s2.obj.updatePixelPosition();
          } catch (e) {}
        }

        // If 6F instance exists, move it north up to 5 tiles (or fall)
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
              try {
                mapService.setTile(oldX6, oldY6, 0, 6);
                mapService.setTile(targetX6, targetY6, "statue_m", newFloor6);
                s6.x = targetX6;
                s6.y = targetY6;
                s6.floor = newFloor6;
                s6.obj.gridX = targetX6;
                s6.obj.gridY = targetY6;
                s6.obj.sprite.visible = s6.floor === mapService.getFloor();
                s6.obj.updatePixelPosition();
              } catch (e) {}
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
        return true;
      };

      // generic handler for non-synced statues (or synced ones from non-special floors)
      const handleGeneric = (st) => {
        // prevent moving the same statue twice
        if (st.moved) {
          modal.style.display = "none";
          showCustomAlert("その像はもう動かせないようだ");
          return false;
        }

        const vec = getVecForFloor(dir, st.floor);
        if (!vec) {
          modal.style.display = "none";
          showCustomAlert("入力が正しくないようだ");
          return false;
        }
        const oldX = st.x;
        const oldY = st.y;
        const floor = st.floor;

        // validate path up to 5 tiles: no wall or out-of-bounds allowed
        const w = mapService.getWidth();
        const h = mapService.getHeight();
        let blocked = false;
        let fell = false;
        let targetX = oldX;
        let targetY = oldY;
        for (let step = 1; step <= 5; step++) {
          const nx = oldX + vec[0] * step;
          const ny = oldY + vec[1] * step;
          // out of bounds -> blocked
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            blocked = true;
            break;
          }
          const t = mapService.getTile(nx, ny, floor);
          // wall blocks
          if (t === TILE.WALL || t === 1) {
            blocked = true;
            break;
          }
          // hole: statue falls to floor-1 at this x,y
          if (t === TILE.HOLE || t === "hole") {
            targetX = nx;
            targetY = ny;
            fell = true;
            break;
          }
          // otherwise, continue; if reached final step without obstacle, that's target
          if (step === 5) {
            targetX = nx;
            targetY = ny;
          }
        }

        if (blocked) {
          modal.style.display = "none";
          showCustomAlert("入力が正しくないようだ");
          return false;
        }

        if (fell) {
          // statue falls to lower floor
          const newFloor = Math.max(1, floor - 1);
          // update map: clear old pos on current floor
          try {
            mapService.setTile(oldX, oldY, 0, floor);
          } catch (e) {}

          // determine destination using cushion mapping if present
          let destX = targetX;
          let destY = targetY;
          let destFloor = newFloor;
          try {
            const cushionMap = window.__cushionMap || {};
            // Prefer direct key matches but also fall back to scanning entries
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
              // fallback: scan all cushionMap entries and match by coordinates
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
            if (found) {
              destX = typeof found.x === "number" ? found.x : destX;
              destY = typeof found.y === "number" ? found.y : destY;
              destFloor = typeof found.f === "number" ? found.f : destFloor;
            }
          } catch (e) {}

          // place statue on destination floor
          try {
            mapService.setTile(destX, destY, st.nameKey, destFloor);
          } catch (e) {}

          // update statue record and visuals
          st.x = destX;
          st.y = destY;
          st.floor = destFloor;
          try {
            st.obj.gridX = destX;
            st.obj.gridY = destY;
            // ensure sprite is visible for the current viewed floor
            st.obj.sprite.visible = st.floor === mapService.getFloor();
            // change to broken statue image and ensure texture is applied
            try {
              const brokenTex = PIXI.Texture.from("img/statue_broken.png");
              if (brokenTex) {
                st.obj.sprite.texture = brokenTex;
                // preserve/ensure correct size
                try {
                  st.obj.sprite.width =
                    typeof TILE_SIZE === "number"
                      ? TILE_SIZE
                      : st.obj.sprite.width;
                  st.obj.sprite.height =
                    typeof TILE_SIZE === "number"
                      ? TILE_SIZE
                      : st.obj.sprite.height;
                } catch (e) {}
              }
            } catch (e) {
              console.error("failed to set broken statue texture", e);
            }
            // force update position
            st.obj.updatePixelPosition();
          } catch (e) {
            console.error("failed to update statue object after fall", e);
          }

          // mark statue as moved so it cannot be moved again
          try {
            st.moved = true;
            st.obj.broken = true;
          } catch (e) {}

          // Debug logging
          try {
            console.log("[statue] fell", {
              nameKey: st.nameKey,
              destX,
              destY,
              destFloor,
            });
          } catch (e) {}

          // If player is at the destination, they die
          try {
            if (window && window.__playerInstance) {
              const p = window.__playerInstance;
              if (
                p.gridX === destX &&
                p.gridY === destY &&
                p.floor === destFloor
              ) {
                console.log(
                  "[statue] player hit by falling statue -> triggerFall"
                );
                try {
                  // Suppress autosave and mark statue as pending restore so
                  // serialize() avoids saving the intermediate broken state.
                  try {
                    if (typeof window !== "undefined")
                      window.__skipSaving = true;
                  } catch (e) {}
                  try {
                    st.__deferredRestore = true;
                  } catch (e) {}
                  try {
                    // prevent the default full-floor reset on fall so our manual
                    // restore of the statue tile is not clobbered
                    if (typeof window !== "undefined")
                      window.__suppressMapResetOnFall = true;
                  } catch (e) {}

                  const onCloseHandler = () => {
                    try {
                      // Only restore if this statue was marked for deferred restore
                      // (set when the player was actually hit by the falling statue).
                      if (!st || !st.__deferredRestore) {
                        try {
                          // ensure we clear any temporary suppression just in case
                          if (typeof window !== "undefined") {
                            try {
                              window.__skipSaving = false;
                            } catch (e) {}
                            try {
                              window.__suppressMapResetOnFall = false;
                            } catch (e) {}
                          }
                        } catch (e) {}
                        return;
                      }

                      try {
                        // clear the broken tile and restore statue tile at its initial position
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

                        // update model to initial position
                        try {
                          st.x = st.initialX;
                          st.y = st.initialY;
                          st.floor = st.initialFloor;
                          st.broken = false;
                          if (st.obj) st.obj.broken = false;
                        } catch (e) {}

                        // restore sprite texture/position if present
                        try {
                          if (st.obj) {
                            try {
                              const origTex =
                                PIXI && PIXI.Texture
                                  ? PIXI.Texture.from(
                                      st.originalTexturePath || "img/statue.png"
                                    )
                                  : null;
                              if (origTex) st.obj.sprite.texture = origTex;
                            } catch (e) {}
                            try {
                              st.obj.gridX = st.initialX;
                              st.obj.gridY = st.initialY;
                              if (
                                typeof st.obj.updatePixelPosition === "function"
                              )
                                st.obj.updatePixelPosition();
                            } catch (e) {}
                            try {
                              if (
                                st.obj.sprite &&
                                typeof st.obj.sprite.interactive !== "undefined"
                              )
                                st.obj.sprite.interactive = true;
                            } catch (e) {}
                          }
                        } catch (e) {}

                        // ensure map tile is correct (statue, not broken)
                        try {
                          mapService.setTile(st.x, st.y, st.nameKey, st.floor);
                        } catch (e) {}

                        // notify systems so autosave can persist the final restored state
                        try {
                          if (typeof emit === "function")
                            emit("statueChanged", { statue: st });
                        } catch (e) {}
                        try {
                          if (typeof emit === "function")
                            emit("playerMoved", {
                              reason: "statueRestoreOnClose",
                            });
                        } catch (e) {}
                        try {
                          if (typeof emit === "function")
                            emit("floorChanged", mapService.getFloor());
                        } catch (e) {}

                        // clear deferred restore marker and re-enable autosave/map reset
                        try {
                          st.__deferredRestore = false;
                        } catch (e) {}
                        try {
                          if (typeof window !== "undefined") {
                            try {
                              window.__skipSaving = false;
                            } catch (e) {}
                            try {
                              window.__suppressMapResetOnFall = false;
                            } catch (e) {}
                          }
                        } catch (e) {}
                      } catch (e) {}
                    } catch (e) {}
                  };

                  // Use requestAnimationFrame to allow renderer to show broken state first
                  if (typeof requestAnimationFrame === "function") {
                    requestAnimationFrame(() => {
                      try {
                        if (typeof p.triggerFall === "function")
                          p.triggerFall("像の落下で轢かれてしまった...", {
                            onClose: onCloseHandler,
                          });
                      } catch (err) {
                        try {
                          if (typeof p.triggerFall === "function")
                            p.triggerFall("像の落下で轢かれてしまった...");
                        } catch (e2) {}
                      }
                    });
                  } else {
                    try {
                      if (typeof p.triggerFall === "function")
                        p.triggerFall("像の落下で轢かれてしまった...", {
                          onClose: onCloseHandler,
                        });
                    } catch (err) {
                      try {
                        if (typeof p.triggerFall === "function")
                          p.triggerFall("像の落下で轢かれてしまった...");
                      } catch (e2) {}
                    }
                  }
                } catch (e) {
                  try {
                    if (typeof p.triggerFall === "function")
                      p.triggerFall("像の落下で轢かれてしまった...");
                  } catch (e2) {}
                }
              }
            }
          } catch (e) {
            console.error("player death check failed", e);
          }

          // If any snake occupies the destination, kill it
          try {
            const killed = snakeManager.killSnakeAt(destX, destY, destFloor);
            if (killed && killed.length) {
              try {
                showCustomAlert("像の落下で蛇が倒された。");
              } catch (e) {}
            }
          } catch (e) {
            console.error("killSnakeAt failed", e);
          }

          try {
            showCustomAlert("像が穴に落ちて下の階に落下した。");
          } catch (e) {}
          return true;
        }

        // normal move to targetX,targetY on same floor
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

        // mark statue as moved for normal moves as well
        try {
          st.moved = true;
        } catch (e) {}

        return true;
      };

      // Execute movement depending on statue type
      let movedOK = true;
      if (nameKey === "statue_m") {
        movedOK = handleStatueM();
      } else {
        // apply generic handler to all matching instances (typically one)
        for (const st of targets) {
          const res = handleGeneric(st);
          if (!res) {
            movedOK = false;
            break;
          }
        }
      }

      // Jesse special-case removed: no longer need to kill the snake at (1,0)

      if (movedOK) {
        showCustomAlert("「ムーブ」を唱え、像を移動した。");
      }
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
  }
}

// expose to global so other modules that call openMoveModal() without importing work
try {
  if (typeof window !== "undefined" && !window.openMoveModal) {
    window.openMoveModal = openMoveModal;
  }
} catch (e) {}
