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
import {
  showCustomAlert,
  openPuzzleModal,
  closePuzzleModal,
} from "./modals.js";
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
import magicManager from "../managers/magicManager.js";
import * as changeManager from "../managers/changeManager.js";

export async function setupUI() {
  const app = initEngine();
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

  // listen for floor change events to update background image
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

  // listen for player moves to step the snake and then evaluate sight
  on("playerMoved", (payload) => {
    try {
      // step snakes (only visible ones by default)
      const moved = snakeManager.stepSnakes({ onlyVisible: true });
      // moved is an array of {id,x,y,floor}

      // after both have moved (player and snake), evaluate line-of-sight
      try {
        if (player.isSnakeInSight()) {
          // if snake now visible, trigger fall
          player.triggerFall("ヘビを見て石化してしまった...！");
        }
      } catch (e) {}

      // Prompt to activate チェンジ when standing on the change tile (once per entry)
      try {
        const tileUnder = mapService.getTile(
          player.gridX,
          player.gridY,
          player.floor
        );
        if (tileUnder === TILE.CHANGE || tileUnder === "change") {
          const posKey = `${player.gridX},${player.gridY},${player.floor}`;
          window.__lastChangePrompt = window.__lastChangePrompt || null;
          if (window.__lastChangePrompt !== posKey) {
            window.__lastChangePrompt = posKey;
            let confirmModal = document.getElementById(
              "change-activate-confirm"
            );
            if (!confirmModal) {
              confirmModal = document.createElement("div");
              confirmModal.id = "change-activate-confirm";
              confirmModal.className = "modal-wrapper";
              confirmModal.style.display = "flex";
              confirmModal.style.position = "fixed";
              confirmModal.style.left = "0";
              confirmModal.style.top = "0";
              confirmModal.style.width = "100%";
              confirmModal.style.height = "100%";
              confirmModal.style.alignItems = "center";
              confirmModal.style.justifyContent = "center";
              confirmModal.style.zIndex = 26000;

              const box = document.createElement("div");
              box.className = "modal-content";
              box.style.padding = "12px";
              box.style.background = "#fff";
              box.style.borderRadius = "6px";
              box.style.display = "flex";
              box.style.flexDirection = "column";
              box.style.gap = "8px";
              box.style.minWidth = "240px";

              const msg = document.createElement("div");
              msg.textContent = "チェンジを発動しますか？";
              box.appendChild(msg);

              const btnWrap = document.createElement("div");
              btnWrap.style.display = "flex";
              btnWrap.style.gap = "8px";
              btnWrap.style.justifyContent = "center";

              const yes = document.createElement("button");
              yes.textContent = "はい";
              yes.className = "ui-button";

              const no = document.createElement("button");
              no.textContent = "いいえ";
              no.className = "ui-button";

              btnWrap.appendChild(yes);
              btnWrap.appendChild(no);
              box.appendChild(btnWrap);
              confirmModal.appendChild(box);
              document.body.appendChild(confirmModal);

              yes.addEventListener("click", () => {
                try {
                  if (
                    changeManager &&
                    typeof changeManager.openChangeModal === "function"
                  )
                    changeManager.openChangeModal();
                } catch (e) {}
                confirmModal.style.display = "none";
              });

              no.addEventListener("click", () => {
                confirmModal.style.display = "none";
              });
            } else {
              confirmModal.style.display = "flex";
            }
          }
        } else {
          // clear tracker so re-entering the tile later shows the prompt again
          window.__lastChangePrompt = null;
        }
      } catch (e) {}
    } catch (e) {}
  });

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

  function handleActionEvent() {
    if (!player) return;
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
          // show pickup alert: "(title)を手に入れた"
          try {
            showCustomAlert((info.title || "情報") + "を手に入れた");
          } catch (e) {
            try {
              window.alert((info.title || "情報") + "を手に入れた");
            } catch (e2) {}
          }
        }
        return;
      }
    } catch (e) {}

    // --- restored: handle box_* pickups (box_1f, box_3f, box_cushion, box_change, box_medusa)
    try {
      const boxKeys = [
        TILE.BOX_1F,
        TILE.BOX_3F,
        TILE.BOX_CUSHION,
        TILE.BOX_CHANGE,
        TILE.BOX_MEDUSA,
      ];
      if (
        typeof currentTileType === "string" &&
        boxKeys.includes(currentTileType)
      ) {
        const key = currentTileType;
        const info = allInfo[key];
        // ensure info entry exists and mark unlocked
        if (info && !info.unlocked) info.unlocked = true;
        // remove tile from map
        try {
          mapService.setTile(x, y, 0);
        } catch (e) {}
        // special handling: acquiring BOX_3F grants MOVE magic
        try {
          if (key === TILE.BOX_3F || key === "box_3f") {
            // previously set playerState.gotMoveMagic = true; now rely on allInfo.box_3f.unlocked
            // allInfo entry was marked unlocked above (info.unlocked = true)
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
  }

  const itemBtn = document.getElementById("item-btn");
  const keywordModal = document.getElementById("keyword-modal");
  if (itemBtn && keywordModal) {
    itemBtn.addEventListener("click", () => {
      const list = document.getElementById("magic-list");
      // --- チェンジの説明文をフロアごとに反映 ---
      try {
        const player = window.__playerInstance;
        const floor = player ? player.floor : null;
        // 保存対象: 3F:エレベ/ムーブ, 4F:エレベ/クッショ, 5F:エレベ
        const floorMap = {
          3: ["エレベ", "ムーブ"],
          4: ["エレベ", "クッショ"],
          5: ["エレベ"],
        };
        // 元の説明文を保存
        window.__originalAllInfo =
          window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
        // まず全てリセット
        ["box_1f", "box_3f", "box_cushion"].forEach((key) => {
          if (window.__originalAllInfo[key] && allInfo[key]) {
            allInfo[key].content = window.__originalAllInfo[key].content;
          }
        });
        // フロアごとのチェンジ状態を反映
        if (floor && floorMap[floor]) {
          // prefer an explicit per-floor store if present, but fall back to older global locations
          const perFloorState =
            (window.__changeStateByFloor &&
              window.__changeStateByFloor[floor]) ||
            {};
          const globalState = window.__changeState || {};

          floorMap[floor].forEach((label) => {
            let key = null;
            if (label === "エレベ") key = "box_1f";
            if (label === "ムーブ") key = "box_3f";
            if (label === "クッショ") key = "box_cushion";
            if (!key) return;

            // determine config for this label, checking per-floor store first then fallbacks
            let cfg = null;
            try {
              if (label === "エレベ") {
                // elevator changes are encoded per-floor in window.__changeState.elevatorPerFloor
                cfg =
                  (globalState &&
                    globalState.elevatorPerFloor &&
                    globalState.elevatorPerFloor[floor]) ||
                  perFloorState["エレベ"] ||
                  null;
              } else if (label === "ムーブ") {
                // prefer per-floor saved move changes, otherwise fall back to global.move but only for 3F
                cfg =
                  perFloorState["ムーブ"] ||
                  (globalState &&
                  globalState.global &&
                  globalState.global.move &&
                  floor === 3
                    ? globalState.global.move
                    : null) ||
                  null;
              } else if (label === "クッショ") {
                // prefer per-floor saved cushion changes, otherwise fall back to global クッショ but only for 4F
                cfg =
                  perFloorState["クッショ"] ||
                  (globalState &&
                  globalState.global &&
                  globalState.global["クッショ"] &&
                  floor === 4
                    ? globalState.global["クッショ"]
                    : null) ||
                  null;
              }
            } catch (e) {
              cfg = null;
            }

            // チェンジ内容があれば反映
            if (cfg) {
              // unified handling: treat cfg.inc (numeric increment) and cfg.dir as source of truth
              const base =
                window.__originalAllInfo && window.__originalAllInfo[key]
                  ? window.__originalAllInfo[key].content
                  : (allInfo[key] && allInfo[key].content) || "";
              // derive increment and direction from various possible shapes
              let inc = 0;
              let displayNum = null;
              // prefer explicit inc
              if (typeof cfg.inc === "number") {
                inc = cfg.inc;
              } else if (typeof cfg.amount === "number") {
                inc = cfg.amount;
              }
              // if floors is provided, use it directly as display number
              if (typeof cfg.floors === "number") {
                displayNum = Number(cfg.floors);
              }
              // determine direction
              let dir = "上";
              if (cfg.dir) dir = cfg.dir;
              else if (cfg.direction) dir = cfg.direction;
              else if (cfg.type === "反転") dir = "下"; // legacy pure inversion

              // compute final display number if not explicitly provided
              if (displayNum === null) displayNum = 1 + (Number(inc) || 0);

              // apply to labels
              if (label === "エレベ") {
                if (typeof base === "string") {
                  if (/1つ[上下]/.test(base)) {
                    allInfo[key].content = base.replace(
                      /1つ[上下]/g,
                      `${displayNum}つ${dir}`
                    );
                  } else {
                    allInfo[key].content = base.replace(
                      /唱えることで[\s\S]*?移動する。/,
                      `唱えることで${displayNum}つ${dir}の階の同じ場所に移動する。`
                    );
                  }
                }
              } else if (label === "クッショ") {
                if (typeof base === "string") {
                  // for cushion, treat numeric increase as amount to add
                  const add = Number(cfg.amount || cfg.inc || 0);
                  allInfo[key].content = base.replace(
                    /(\d+)歩/,
                    (m, p1) => `${Number(p1) + add}歩`
                  );
                }
              }
            }
          });
        }
      } catch (e) {
        console.error("changeStateByFloor magic modal update failed", e);
      }
      // ---
      try {
        // call imported renderMagicList directly to avoid scope issues
        if (typeof renderMagicList === "function") renderMagicList(list);
      } catch (e) {
        console.error("renderMagicList failed:", e);
      }
      // Ensure magic modal always opens to page 1 (reset any previous page state)
      try {
        const magicPage1 = document.getElementById("magic-page-1");
        const magicPage2 = document.getElementById("magic-page-2");
        if (magicPage1) magicPage1.style.display = "block";
        if (magicPage2) magicPage2.style.display = "none";
      } catch (e) {}
      keywordModal.style.display = "flex";
    });
    // close/back handlers are initialized in initInfoModalHandlers
  }

  const puzzleBtn = document.getElementById("puzzle-btn");
  if (puzzleBtn) {
    puzzleBtn.addEventListener("click", () => {
      const puzzleModal = document.getElementById("puzzle-modal");
      if (puzzleModal) puzzleModal.style.display = "flex";
      const list = document.getElementById("puzzle-set-list");
      renderPuzzleSetList(list);
    });
  }

  // wire puzzle modal close/back buttons like original
  const puzzleBackBtn = document.getElementById("puzzle-back-btn");
  const puzzleCloseBtn = document.getElementById("puzzle-close-btn");
  if (puzzleBackBtn) {
    puzzleBackBtn.addEventListener("click", () => {
      const puzzlePage2 = document.getElementById("puzzle-page-2");
      const puzzlePage1 = document.getElementById("puzzle-page-1");
      if (puzzlePage2) puzzlePage2.style.display = "none";
      if (puzzlePage1) puzzlePage1.style.display = "block";
    });
  }
  if (puzzleCloseBtn)
    puzzleCloseBtn.addEventListener("click", () => {
      const puzzleModal = document.getElementById("puzzle-modal");
      if (puzzleModal) puzzleModal.style.display = "none";
    });

  // ensure puzzle modal overlay click closes like original
  const puzzleModalEl = document.getElementById("puzzle-modal");
  if (puzzleModalEl) {
    puzzleModalEl.addEventListener("click", (e) => {
      if (e.target === puzzleModalEl) puzzleModalEl.style.display = "none";
    });
  }

  const infoBtn = document.getElementById("info-btn");
  if (infoBtn)
    infoBtn.addEventListener("click", () => {
      openInfoModal(
        document.getElementById("info-modal"),
        document.getElementById("info-page-1"),
        document.getElementById("info-page-2"),
        document.getElementById("info-list")
      );
    });

  // 魔法入力欄のロジック
  // initialize magic handlers via manager
  try {
    magicManager.init();
  } catch (e) {
    console.error("magicManager.init failed", e);
  }

  const infoClose = document.getElementById("info-close-btn");
  if (infoClose)
    infoClose.addEventListener("click", () =>
      closeInfoModal(document.getElementById("info-modal"))
    );
  const infoBack = document.getElementById("info-back-btn");
  if (infoBack)
    infoBack.addEventListener("click", () => {
      document.getElementById("info-page-1").style.display = "block";
      document.getElementById("info-page-2").style.display = "none";
    });

  const infoList = document.getElementById("info-list");
  if (infoList)
    infoList.addEventListener("click", (event) => {
      if (event.target.tagName === "LI") {
        const key = event.target.dataset.key;
        showInfoDetail(
          key,
          document.getElementById("info-detail-title"),
          document.getElementById("info-detail-content")
        );
      }
    });

  // initialize info modal handlers (list click etc.)
  initInfoModalHandlers();
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
                  // Ensure the broken sprite and position are rendered before showing the death alert
                  if (typeof requestAnimationFrame === "function") {
                    requestAnimationFrame(() => {
                      try {
                        p.triggerFall("像の落下で轢かれてしまった...");
                      } catch (err) {
                        console.error("triggerFall failed on player", err);
                      }
                    });
                  } else {
                    p.triggerFall("像の落下で轢かれてしまった...");
                  }
                } catch (e) {
                  try {
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
