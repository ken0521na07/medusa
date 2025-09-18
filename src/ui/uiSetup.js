import {
  handleGetPuzzlePiece,
  renderPuzzleSetList,
} from "../managers/puzzleManager.js";
import {
  openInfoModal,
  closeInfoModal,
  showInfoDetail,
  initInfoModalHandlers,
  renderMagicList,
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

  // initialize statue sprites from MAPS (statue_* tiles)
  const statues = [];
  function initStatues() {
    try {
      for (const [floorKey, map] of Object.entries(MAPS)) {
        const floor = parseInt(floorKey, 10);
        for (let y = 0; y < map.length; y++) {
          const row = map[y] || [];
          for (let x = 0; x < row.length; x++) {
            const t = row[x];
            if (typeof t === "string" && t.startsWith("statue_")) {
              const nameKey = t; // e.g. 'statue_j'
              // create a simple GameObject sprite for the statue
              try {
                const g = new GameObject(x, y, "img/statue.png");
                g.sprite.visible = floor === mapService.getFloor();
                app._layers.entityLayer.addChild(g.sprite);
                statues.push({ x, y, floor, nameKey, obj: g });
              } catch (e) {
                console.error("initStatues: failed to create statue sprite", e);
              }
            }
          }
        }
      }
    } catch (e) {}
  }
  initStatues();
  // expose statues globally so external helpers/modals can access them
  try {
    window.__statues = statues;
  } catch (e) {}
  // ensure visibility sync runs now that statues exist
  try {
    emit("floorChanged", mapService.getFloor());
  } catch (e) {}

  // listen for player moves to step the snake and then evaluate sight
  on("playerMoved", (payload) => {
    try {
      // step snakes (only visible ones by default)
      const moved = snakeManager.stepSnakes({ onlyVisible: true });
      // moved is an array of {id,x,y,floor}
      // you can use it for debug if needed
      // console.log('snakes moved', moved);

      // after both have moved (player and snake), evaluate line-of-sight
      try {
        if (player.isSnakeInSight()) {
          // if snake now visible, trigger fall
          player.triggerFall("ヘビを見て石化してしまった...！");
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
      // reveal statue name; for statue_j show ジェシー
      let msg = "この像の名前は不明だ。";
      if (frontTile === TILE.STATUE_J || frontTile === "statue_j")
        msg = "この像の名前はジェシーです。";
      showCustomAlert(msg);
      return;
    }

    const x = player.gridX;
    const y = player.gridY;
    const currentTileType = mapService.getTile(x, y);

    switch (currentTileType) {
      case TILE.PUZZLE_3:
        // 3F の一括解放：1マス調べるだけで4つ全て解放される
        try {
          const set = allPuzzles["elevator_3f"];
          if (set) {
            set.unlocked = true;
            for (const p of set.pieces) p.unlocked = true;
            // remove tile from map
            mapService.setTile(x, y, 0);
            // show custom alert instead of opening puzzle modal
            try {
              showCustomAlert("謎を入手した");
            } catch (e) {
              try {
                window.alert("謎を入手した");
              } catch (e) {}
            }
          }
        } catch (e) {
          console.error("failed to unlock 3F puzzles", e);
        }
        break;
      case TILE.INFO_IMG:
      case TILE.INFO_HOLE:
      case TILE.INFO_SNAKE:
      case TILE.INFO_SNAKE_G:
      case TILE.INFO_STATUE:
        try {
          const key = currentTileType; // matches allInfo keys like 'info_img'
          if (allInfo && allInfo[key]) allInfo[key].unlocked = true;
        } catch (e) {}
        // remove tile so it can't be obtained again
        mapService.setTile(x, y, 0);
        try {
          const infoObj = allInfo && allInfo[currentTileType];
          const title = (infoObj && infoObj.title) || "情報";
          showCustomAlert(`${title}を手に入れた`);
        } catch (e) {}
        break;
      case TILE.BOX_1F:
        {
          try {
            if (allInfo && allInfo.box_1f) allInfo.box_1f.unlocked = true;
          } catch (e) {}
          mapService.setTile(x, y, 0);
          try {
            showCustomAlert("魔法「エレベ」を入手した。冊子4ページを開こう");
          } catch (e) {}
        }
        break;
      case TILE.BOX_3F:
        {
          if (!playerState.gotMoveMagic) {
            playerState.gotMoveMagic = true;
            try {
              if (allInfo && allInfo.box_3f) allInfo.box_3f.unlocked = true;
            } catch (e) {}
            mapService.setTile(x, y, 0);
            try {
              showCustomAlert(
                "魔法「ムーブ」を入手した。冊子６ページを開こう。"
              );
            } catch (e) {}
          } else {
            showCustomAlert("既に魔法「ムーブ」は入手している。");
          }
        }
        break;
      case TILE.BOX_CUSHION:
        {
          try {
            if (allInfo && allInfo.box_cushion)
              allInfo.box_cushion.unlocked = true;
          } catch (e) {}
          mapService.setTile(x, y, 0);
          try {
            showCustomAlert(
              "魔法「クッショ」を入手した。冊子10ページを開こう。"
            );
          } catch (e) {}
        }
        break;
      case TILE.BOX_CHANGE:
        {
          try {
            if (allInfo && allInfo.box_change)
              allInfo.box_change.unlocked = true;
          } catch (e) {}
          mapService.setTile(x, y, 0);
          try {
            showCustomAlert(
              "魔法「チェンジ」を入手した。冊子８ページを開こう。"
            );
          } catch (e) {}
        }
        break;
      case TILE.PUZZLE_1H:
        handleGetPuzzlePiece("elevator_1f", currentTileType, { x, y });
        showCustomAlert(
          "ハートの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_1D:
        handleGetPuzzlePiece("elevator_1f", currentTileType, { x, y });
        showCustomAlert(
          "ダイヤの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_1S:
        handleGetPuzzlePiece("elevator_1f", currentTileType, { x, y });
        showCustomAlert(
          "スペードの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_1C:
        handleGetPuzzlePiece("elevator_1f", currentTileType, { x, y });
        showCustomAlert(
          "クローバーの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_2H:
        // ハートの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert(
          "ハートの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_2D:
        // ダイヤの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert(
          "ダイヤの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_2S:
        // スペードの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert(
          "スペードの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_2C:
        // クローバーの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert(
          "クローバーの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_4H:
        handleGetPuzzlePiece("elevator_4f", currentTileType, { x, y });
        showCustomAlert(
          "ハートの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_4D:
        handleGetPuzzlePiece("elevator_4f", currentTileType, { x, y });
        showCustomAlert(
          "ダイヤの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_4S:
        handleGetPuzzlePiece("elevator_4f", currentTileType, { x, y });
        showCustomAlert(
          "スペードの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_4C:
        handleGetPuzzlePiece("elevator_4f", currentTileType, { x, y });
        showCustomAlert(
          "クローバーの謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
        );
        break;
      case TILE.PUZZLE_3:
        // 3F の一括解放：1マス調べるだけで4つ全て解放される
        // proceed to unlock via synchronous access to allPuzzles
        try {
          // perform changes directly on allPuzzles imported at module top
          const set = allPuzzles["elevator_3f"];
          if (set) {
            set.unlocked = true;
            for (const p of set.pieces) {
              p.unlocked = true;
            }
            // remove the tile from the map so it can't be obtained again
            mapService.setTile(x, y, 0);
            // show a generic pickup message for 3F
            showCustomAlert(
              "謎を入手した。画面の【謎】ボタンから入手した謎を確認できます"
            );
            // open puzzle modal to show the set
            try {
              openPuzzleModal();
            } catch (e) {}
            const puzzleGridTitle =
              document.getElementById("puzzle-grid-title");
            const puzzlePage1 = document.getElementById("puzzle-page-1");
            const puzzlePage2 = document.getElementById("puzzle-page-2");
            const puzzleGrid = document.getElementById("puzzle-grid");
            if (puzzleGridTitle)
              puzzleGridTitle.textContent = set.title || "謎|3F";
            if (puzzlePage1) puzzlePage1.style.display = "none";
            if (puzzlePage2) puzzlePage2.style.display = "flex";
            if (typeof renderPuzzleGrid === "function")
              renderPuzzleGrid(set, puzzleGrid);
          }
        } catch (e) {
          console.error("failed to unlock 3F puzzles", e);
        }
        break;
      default:
        break;
    }
  }

  const actionA = document.getElementById("action-a-btn");
  if (actionA) actionA.addEventListener("click", handleActionEvent);

  const itemBtn = document.getElementById("item-btn");
  const keywordModal = document.getElementById("keyword-modal");
  if (itemBtn && keywordModal) {
    itemBtn.addEventListener("click", () => {
      const list = document.getElementById("magic-list");
      // render magic list (only unlocked box_* entries)
      try {
        // call imported renderMagicList directly to avoid scope issues
        if (typeof renderMagicList === "function") renderMagicList(list);
      } catch (e) {
        console.error("renderMagicList failed:", e);
      }
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
  const magicInput = document.getElementById("magic-input-text");
  const magicSubmit = document.getElementById("magic-input-submit");
  if (magicSubmit && magicInput) {
    const accepted = ["ぱいきじ", "パイ生地", "パイキジ", "ぱい 生地"];

    const normalize = (s) => (s || "").replace(/\s+/g, "").trim();

    const checkMagic = () => {
      const raw = normalize(magicInput.value);
      const player = window.__playerInstance;
      const x = player ? player.gridX : null;
      const y = player ? player.gridY : null;
      const floor = player ? player.floor : null;

      // helper to compute elevator target floor based on change state
      const computeElevatorTarget = (currentFloor, defaultDelta = 1) => {
        try {
          if (!window.__changeState || !window.__changeState.elevatorPerFloor) {
            return currentFloor + defaultDelta;
          }
          const cfg = window.__changeState.elevatorPerFloor[currentFloor];
          if (!cfg) return currentFloor + defaultDelta;
          if (cfg.type === "増加") {
            const amt = Number(cfg.floors || cfg.amount || defaultDelta);
            const dir = cfg.direction || "上";
            return currentFloor + (dir === "上" ? amt : -amt);
          }
          if (cfg.type === "反転") {
            // meaning inversion: flip the default delta if user chose the default direction
            // cfg.direction indicates which original direction is considered 'flipped'
            const dir = cfg.direction || "上";
            // if original intent is 'up' (defaultDelta positive) and user flipped '上', make negative
            if (dir === "上") return currentFloor - Math.abs(defaultDelta);
            // if flipped '下', invert to positive
            return currentFloor + Math.abs(defaultDelta);
          }
        } catch (e) {}
        return currentFloor + defaultDelta;
      };

      // debug info
      console.log(
        "[magic] input=",
        magicInput.value,
        "normalized=",
        raw,
        "player=",
        x,
        y,
        "floor=",
        floor
      );

      // Special spell: えいぞう -> teleport from 2F (5,5) to 3F (5,5)
      const showAccepted = ["えいぞう", "映像", "エイゾウ"];
      const normalizedShow = showAccepted.map((s) => normalize(s));
      const isShowSpell = normalizedShow.includes(raw);

      // MOVE spell handling
      const moveAccepted = ["fox", "フォックス", "FOX"];
      const normalizedMoveAccepted = moveAccepted.map((s) =>
        normalize(s).toLowerCase()
      );
      const isMoveSpell = normalizedMoveAccepted.includes(
        (raw || "").toLowerCase()
      );
      if (isMoveSpell) {
        // The move spell (fox) may only be used on 3F at (9,5).
        if (floor === 3 && x === 9 && y === 5) {
          if (!playerState.gotMoveMagic) {
            const msg = "正しい魔法陣の上で唱えよう";
            try {
              showCustomAlert(msg);
            } catch (e) {
              try {
                window.alert(msg);
              } catch (e2) {}
            }
            return;
          }
          // correct word and correct place -> open move modal
          openMoveModal();
          return;
        }
        // correct word but wrong place
        const msg = "正しい魔法陣の上で唱えよう";
        console.log(
          "[magic] correct-spell-wrong-place for fox: player=",
          x,
          y,
          "floor=",
          floor
        );
        try {
          showCustomAlert(msg);
        } catch (e) {
          try {
            window.alert(msg);
          } catch (e2) {}
        }
        return;
      }

      if (isShowSpell) {
        if (floor === 2 && x === 5 && y === 5) {
          try {
            teleportPlayer(5, 5, 3);
            showCustomAlert(
              "「えいぞう」を唱え、3Fに移動した。封筒Bを開こう。"
            );
          } catch (e) {
            try {
              window.alert("魔法が唱えられた！正解です。");
            } catch (e2) {}
          }
        } else {
          const msg = "正しい魔法陣の上で唱えよう";
          console.log(
            "[magic] correct-spell-wrong-place for えいぞう: player=",
            x,
            y,
            "floor=",
            floor
          );
          try {
            showCustomAlert(msg);
          } catch (e) {
            try {
              window.alert(msg);
            } catch (e2) {}
          }
        }
        return;
      }

      // elevator spell handling (エレベ系)
      // existing accepted words (エレべ)
      const normalizedAccepted = accepted.map((a) => normalize(a));
      const isElevatorSpell = normalizedAccepted.includes(raw);

      // New: 3F->4F spell words
      const up4Accepted = ["たいせき", "体積", "タイセキ"];
      const normalizedUp4 = up4Accepted.map((s) => normalize(s));
      const isUp4Spell = normalizedUp4.includes(raw);

      // 新: チェンジ魔法の検出
      const changeAccepted = ["チェンジ", "ちぇんじ"];
      const normalizedChange = changeAccepted.map((s) => normalize(s));
      const isChangeSpell = normalizedChange.includes(raw);
      if (isChangeSpell) {
        try {
          openChangeModal();
        } catch (e) {}
        return;
      }

      if (isElevatorSpell) {
        // only allow 1F -> 2F when standing on magic tile (5,5) on 1F
        if (floor === 1 && x === 5 && y === 5) {
          try {
            const target = computeElevatorTarget(floor, 1);
            if (target < 1 || target > 4) throw new Error("invalid target");
            teleportPlayer(5, 5, target);
            showCustomAlert(
              `「エレべ」を唱え、${floor}Fから${target}Fに移動した。封筒Aを開こう`
            );
          } catch (e) {
            try {
              window.alert("魔法が唱えられた！正解です。");
            } catch (e2) {}
          }
        } else {
          const msg = "正しい魔法陣の上で唱えよう";
          console.log(
            "[magic] correct-spell-wrong-place for エレべ: player=",
            x,
            y,
            "floor=",
            floor
          );
          try {
            showCustomAlert(msg);
          } catch (e) {
            try {
              window.alert(msg);
            } catch (e2) {}
          }
        }
      } else if (isUp4Spell) {
        // allow 3F -> 4F when standing on magic tile (5,5) on 3F
        if (floor === 3 && x === 5 && y === 5) {
          try {
            const target = computeElevatorTarget(floor, 1);
            if (target < 1 || target > 4) throw new Error("invalid target");
            teleportPlayer(5, 5, target);
            showCustomAlert(
              `「エレべ」を唱え、${floor}Fから${target}Fに移動した。封筒Cを開こう`
            );
          } catch (e) {
            try {
              window.alert("魔法が唱えられた！正解です。");
            } catch (e2) {}
          }
        } else {
          const msg = "正しい魔法陣の上で唱えよう";
          console.log(
            "[magic] correct-spell-wrong-place for エレべ(3->4): player=",
            x,
            y,
            "floor=",
            floor
          );
          try {
            showCustomAlert(msg);
          } catch (e) {
            try {
              window.alert(msg);
            } catch (e2) {}
          }
        }
      } else {
        // 入力自体が間違っている場合
        const msg = "呪文が間違っているようだ";
        console.log("[magic] wrong-spell:", raw);
        try {
          showCustomAlert(msg);
        } catch (e) {
          try {
            window.alert(msg);
          } catch (e2) {}
        }
      }
    };

    // IME 対応: composition 中は Enter を送信しない、compositionend 直後の Enter を無視
    let _isComposing = false;
    let _ignoreNextEnter = false;
    magicInput.addEventListener("compositionstart", () => {
      _isComposing = true;
    });
    magicInput.addEventListener("compositionend", () => {
      _isComposing = false;
      _ignoreNextEnter = true;
      setTimeout(() => {
        _ignoreNextEnter = false;
      }, 100);
    });

    magicSubmit.addEventListener("click", checkMagic);
    magicInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        console.log(
          "[magic] keydown Enter, isComposing=",
          _isComposing,
          "e.isComposing=",
          e.isComposing,
          "_ignoreNextEnter=",
          _ignoreNextEnter
        );
        if (_isComposing || _ignoreNextEnter || e.isComposing) return;
        e.preventDefault();
        checkMagic();
      }
    });
    // keyup fallback for environments where keydown may be swallowed by IME
    magicInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        console.log(
          "[magic] keyup Enter, isComposing=",
          _isComposing,
          "e.isComposing=",
          e.isComposing,
          "_ignoreNextEnter=",
          _ignoreNextEnter
        );
        if (_isComposing || _ignoreNextEnter || e.isComposing) return;
        checkMagic();
      }
    });
    // After clicking submit, clear the input for convenience
    magicSubmit.addEventListener("click", () => {
      try {
        magicInput.value = "";
      } catch (e) {}
    });
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
      // Validate: must be "ジェシー" and direction "北"
      if (name !== "ジェシー") {
        modal.style.display = "none";
        showCustomAlert("入力が正しくないようだ");
        return;
      }
      // find statue_j in statues list
      const s = statues.find((st) => st.nameKey === "statue_j");
      if (!s) {
        modal.style.display = "none";
        showCustomAlert("その像は見つからないようだ");
        return;
      }
      // direction vector
      const dirMap = { 東: [1, 0], 西: [-1, 0], 南: [0, 1], 北: [0, -1] };
      const vec = dirMap[dir];
      if (!vec) {
        modal.style.display = "none";
        showCustomAlert("入力が正しくないようだ");
        return;
      }
      const oldX = s.x;
      const oldY = s.y;
      const floor = s.floor;

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
        return;
      }

      if (fell) {
        // statue falls to lower floor
        const newFloor = Math.max(1, floor - 1);
        // update map: clear old pos on current floor
        try {
          mapService.setTile(oldX, oldY, 0, floor);
        } catch (e) {}
        // place statue on lower floor at same x,y
        try {
          mapService.setTile(targetX, targetY, TILE.STATUE_J, newFloor);
        } catch (e) {}
        // update statue record
        s.x = targetX;
        s.y = targetY;
        s.floor = newFloor;
        try {
          s.obj.gridX = targetX;
          s.obj.gridY = targetY;
          // sprite visibility may need toggling depending on current viewed floor
          s.obj.sprite.visible = s.floor === mapService.getFloor();
          s.obj.updatePixelPosition();
        } catch (e) {}
        showCustomAlert("像が穴に落ちて下の階に落下した。");
        modal.style.display = "none";
        return;
      }

      // normal move to targetX,targetY on same floor
      try {
        mapService.setTile(oldX, oldY, 0, floor);
        mapService.setTile(targetX, targetY, TILE.STATUE_J, floor);
      } catch (e) {}
      s.x = targetX;
      s.y = targetY;
      try {
        s.obj.gridX = targetX;
        s.obj.gridY = targetY;
        s.obj.updatePixelPosition();
      } catch (e) {}
      showCustomAlert("「ムーブ」を唱え、像を移動した。");
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
  }
}

// Create change modal UI on demand
function openChangeModal() {
  let modal = document.getElementById("change-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "change-modal";
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
    // slightly more padding to match other modals
    box.style.padding = "16px";
    box.style.background = "#fff";
    box.style.borderRadius = "6px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    box.style.minWidth = "240px";

    // テキスト1
    const t1 = document.createElement("div");
    t1.textContent = "①「チェンジ」を使用する対象の魔法を選択してください";
    box.appendChild(t1);

    // プルダウン1
    const select1 = document.createElement("select");
    select1.id = "change-target-select";
    ["エレベ", "ムーブ", "クッショ", "チェンジ"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select1.appendChild(o);
    });
    box.appendChild(select1);

    // direction select (for エレベ)
    const dirLabel = document.createElement("div");
    dirLabel.id = "change-direction-label";
    dirLabel.textContent = "方向を選択してください（上/下）";
    dirLabel.style.display = "none";
    box.appendChild(dirLabel);

    const dirSelect = document.createElement("select");
    dirSelect.id = "change-direction-select";
    ["上", "下"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      dirSelect.appendChild(o);
    });
    dirSelect.style.display = "none";
    box.appendChild(dirSelect);

    // テキスト2
    const t2 = document.createElement("div");
    t2.textContent = "②使用する効果を選択してください（数字増加or意味反転）";
    box.appendChild(t2);

    // プルダウン2
    const select2 = document.createElement("select");
    select2.id = "change-effect-select";
    ["数字増加", "意味反転"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select2.appendChild(o);
    });
    // default to 意味反転
    select2.value = "意味反転";
    box.appendChild(select2);

    // テキスト3 + プルダウン3 (増加量) (hidden by default)
    const t3 = document.createElement("div");
    t3.id = "change-amount-label";
    t3.textContent = "③増加量を選択してください";
    t3.style.display = "none";
    box.appendChild(t3);

    const select3 = document.createElement("select");
    select3.id = "change-amount-select";
    select3.style.display = "none";
    for (let i = 1; i <= 5; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      select3.appendChild(o);
    }
    box.appendChild(select3);

    // ムーブ用オプション（同じ/違う）
    const moveLabel = document.createElement("div");
    moveLabel.id = "change-move-label";
    moveLabel.textContent =
      "ムーブで指定できる像: 同じ/違う を選択してください";
    moveLabel.style.display = "none";
    box.appendChild(moveLabel);

    const moveSelect = document.createElement("select");
    moveSelect.id = "change-move-select";
    ["同じ", "違う"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      moveSelect.appendChild(o);
    });
    moveSelect.style.display = "none";
    box.appendChild(moveSelect);

    // submit button
    const submit = document.createElement("button");
    submit.textContent = "送信";
    submit.id = "change-submit-btn";
    // match other UI buttons appearance
    submit.className = "ui-button";
    box.appendChild(submit);

    // close button
    const close = document.createElement("button");
    close.textContent = "閉じる";
    close.id = "change-close-btn";
    // mark as close for header styling consistency
    close.className = "close-btn";
    // make close button visually compact to match custom alert/modal close
    close.style.padding = "6px 8px";
    close.style.fontSize = "0.95em";
    close.style.alignSelf = "flex-end";
    box.appendChild(close);

    modal.appendChild(box);
    document.body.appendChild(modal);

    // helper: ensure global change state exists
    window.__changeState = window.__changeState || {
      elevatorPerFloor: {},
      global: {},
    };

    // show/hide fields based on target and effect
    function updateFieldVisibility() {
      const target = select1.value;
      const effect = select2.value;
      if (target === "エレベ") {
        // Don't show explicit 上/下 selection in チェンジ modal for エレベ
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        if (effect === "数字増加") {
          t3.style.display = "block";
          select3.style.display = "block";
        } else {
          t3.style.display = "none";
          select3.style.display = "none";
        }
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      } else if (target === "ムーブ") {
        // Move only needs effect selection; no extra fields shown here
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        t3.style.display = "none";
        select3.style.display = "none";
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      } else if (target === "クッショ") {
        // Cushion only supports 数字増加 (and we accept +1 only)
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
        if (effect === "数字増加") {
          t3.style.display = "block";
          select3.style.display = "block";
          // restrict options visually to 1 (we keep full select but validation enforces 1)
        } else {
          t3.style.display = "none";
          select3.style.display = "none";
        }
      } else {
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        t3.style.display = "none";
        select3.style.display = "none";
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      }
    }

    select1.addEventListener("change", updateFieldVisibility);
    select2.addEventListener("change", updateFieldVisibility);

    close.addEventListener("click", () => {
      modal.style.display = "none";
    });

    submit.addEventListener("click", () => {
      const target = select1.value;
      const effect = select2.value;
      const amount = select3.value;
      const direction = dirSelect.value;
      const moveOpt = moveSelect.value;

      const player = window.__playerInstance;
      const floor = player ? player.floor : null;

      // validation helper
      const invalid = () => {
        try {
          showCustomAlert("今はそれをする必要はない");
        } catch (e) {
          try {
            window.alert("今はそれをする必要はない");
          } catch (e2) {}
        }
      };

      // Apply based on target
      if (target === "エレベ") {
        if (!floor) {
          invalid();
          return;
        }
        // Allowed increases per-floor (as specified)
        const allowed = {
          3: [2, 3],
          // allow +1 on 4F per user request
          4: [1, 2],
          5: [2],
        };
        if (effect === "数字増加") {
          const num = Number(amount || 1);
          const allowedForFloor = allowed[floor] || [2];
          if (!allowedForFloor.includes(num)) {
            invalid();
            return;
          }
          // persist per-floor
          window.__changeState.elevatorPerFloor[floor] = {
            type: "増加",
            floors: num,
            // direction selection intentionally not exposed in modal; default to 上
            direction: direction || "上",
          };
        } else if (effect === "意味反転") {
          // Toggle meaning inversion: if already inverted, remove to restore original
          const existing = window.__changeState.elevatorPerFloor[floor];
          if (existing && existing.type === "反転") {
            // remove inversion to return to original
            try {
              delete window.__changeState.elevatorPerFloor[floor];
            } catch (e) {}
          } else {
            window.__changeState.elevatorPerFloor[floor] = {
              type: "反転",
            };
          }
        } else {
          invalid();
          return;
        }
        // update magic description for elevator to reflect per-floor changes
        try {
          // keep an original copy to allow safe replacements
          window.__originalAllInfo =
            window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
          const changes = window.__changeState.elevatorPerFloor || {};
          // pick the most recent config if any
          const cfg = changes[Object.keys(changes).slice(-1)[0]] || null;
          // base text comes from the original copy to avoid cumulative replacements
          let base =
            (window.__originalAllInfo &&
              window.__originalAllInfo.box_1f &&
              window.__originalAllInfo.box_1f.content) ||
            (allInfo && allInfo.box_1f && allInfo.box_1f.content) ||
            "";
          // Some earlier runs left literal '\\n' sequences in the string. Convert them to real newlines
          if (typeof base === "string") base = base.replace(/\\n/g, "\n");
          let newContent = base;
          if (cfg) {
            if (cfg.type === "増加") {
              // determine number and direction
              const num = cfg.floors || cfg.amount || 1;
              const dir = cfg.direction || "上";
              // Prefer targeted replacement of the '1つ上' phrase if present
              if (/1つ[上下]/.test(base)) {
                newContent = base.replace(/1つ[上下]/g, `${num}つ${dir}`);
              } else {
                // fallback to replacing the whole clause
                newContent = base.replace(
                  /唱えることで[\s\S]*?移動する。/,
                  `唱えることで${num}つ${dir}の階の同じ場所に移動する。`
                );
              }
            } else if (cfg.type === "反転") {
              // meaning inversion: flip 上 <-> 下 (prefer flipping the '1つ上' phrase)
              if (typeof base === "string") {
                if (/1つ上/.test(base)) {
                  newContent = base.replace(/1つ上/, "1つ下");
                } else if (/1つ下/.test(base)) {
                  newContent = base.replace(/1つ下/, "1つ上");
                } else {
                  // fallback: flip the first 上 or 下 inside the elevator sentence
                  const flipped = base.replace(
                    /(唱えることで[\s\S]*?)(上|下)([\s\S]*?移動する。)/,
                    (m, p1, p2, p3) => {
                      const f = p2 === "上" ? "下" : "上";
                      return `${p1}${f}${p3}`;
                    }
                  );
                  newContent = flipped;
                }
              }
              // Ensure '同じ' in the original elevator text is never turned into '違う'.
              try {
                const origElev =
                  (window.__originalAllInfo &&
                    window.__originalAllInfo.box_1f &&
                    window.__originalAllInfo.box_1f.content) ||
                  "";
                if (
                  typeof origElev === "string" &&
                  origElev.includes("同じ") &&
                  typeof newContent === "string"
                ) {
                  // restore '違う' back to '同じ' for elevator text to exclude 同じ/違う from inversion
                  newContent = newContent
                    .replace(/違う場所/g, "同じ場所")
                    .replace(/違う/g, "同じ");
                }
              } catch (e) {}
            }
          }
          if (allInfo && allInfo.box_1f) {
            allInfo.box_1f.content = newContent;
          }
        } catch (e) {}
      } else if (target === "ムーブ") {
        // For ムーブ, only '意味反転' is applicable and it toggles: replace the first occurrence of '同じ' with '違う' when active
        if (effect !== "意味反転") {
          invalid();
          return;
        }
        const existingMove =
          window.__changeState.global && window.__changeState.global.move;
        if (existingMove && existingMove.type === "反転") {
          // remove inversion
          try {
            delete window.__changeState.global.move;
            // restore original text if available
            window.__originalAllInfo =
              window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
            const orig =
              (window.__originalAllInfo &&
                window.__originalAllInfo.box_3f &&
                window.__originalAllInfo.box_3f.content) ||
              "";
            if (allInfo && allInfo.box_3f) allInfo.box_3f.content = orig;
          } catch (e) {}
        } else {
          // apply inversion
          try {
            window.__changeState.global.move = { type: "反転" };
            window.__originalAllInfo =
              window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
            const base3 =
              (window.__originalAllInfo &&
                window.__originalAllInfo.box_3f &&
                window.__originalAllInfo.box_3f.content) ||
              (allInfo && allInfo.box_3f && allInfo.box_3f.content) ||
              "";
            // perform single replacement of the word '同じ' -> '違う'
            let new3;
            if (typeof base3 === "string") {
              // replace only the first occurrence
              new3 = base3.replace(/同じ/, "違う");
            } else {
              new3 = base3;
            }
            if (allInfo && allInfo.box_3f) allInfo.box_3f.content = new3;
          } catch (e) {}
        }
      } else if (target === "クッショ") {
        // Special-case: クッショ supports only numeric +1 globally
        if (effect !== "数字増加") {
          invalid();
          return;
        }
        const num = Number(amount || 1);
        // only accept +1 as valid change
        if (num !== 1) {
          invalid();
          return;
        }
        // persist globally
        window.__changeState.global["クッショ"] = { type: "増加", amount: num };
        // update info text for cushion: replace first occurrence of '3歩' with '4歩'
        try {
          window.__originalAllInfo =
            window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
          const baseC =
            (window.__originalAllInfo &&
              window.__originalAllInfo.box_cushion &&
              window.__originalAllInfo.box_cushion.content) ||
            (allInfo && allInfo.box_cushion && allInfo.box_cushion.content) ||
            "";
          let newC = baseC;
          if (typeof baseC === "string") {
            newC = baseC.replace(/(\d+)歩/, (m, p1) => {
              // increase by 1
              const next = String(Number(p1) + num);
              return `${next}歩`;
            });
          }
          if (allInfo && allInfo.box_cushion)
            allInfo.box_cushion.content = newC;
        } catch (e) {}
      } else {
        // For other spells, accept numeric/meaning changes and save globally
        if (effect === "数字増加") {
          window.__changeState.global[target] = {
            type: "増加",
            amount: Number(amount || 1),
          };
        } else if (effect === "意味反転") {
          window.__changeState.global[target] = { type: "反転" };
        } else {
          invalid();
          return;
        }
        // try to update a generic info entry if exists
        try {
          const keyMap = { クッショ: "box_cushion", チェンジ: "box_change" };
          const key = keyMap[target];
          if (key && allInfo && allInfo[key]) {
            allInfo[key].content =
              allInfo[key].content + "\n(チェンジで編集済み)";
          }
        } catch (e) {}
      }

      // refresh magic list UI if open
      try {
        const list = document.getElementById("magic-list");
        if (list && typeof renderMagicList === "function")
          renderMagicList(list);
        // if magic detail page is open and currently showing the affected magic, refresh it
        try {
          const magicPage2 = document.getElementById("magic-page-2");
          const magicTitle = document.getElementById("magic-detail-title");
          const contentEl = document.getElementById("magic-detail-content");
          if (
            magicPage2 &&
            magicPage2.style.display !== "none" &&
            magicTitle &&
            contentEl
          ) {
            // map target labels to info keys
            const map = {
              エレベ: "box_1f",
              ムーブ: "box_3f",
              クッショ: "box_cushion",
              チェンジ: "box_change",
            };
            const key = map[target];
            if (
              key &&
              allInfo[key] &&
              magicTitle.textContent === allInfo[key].title
            ) {
              // call showInfoDetail to re-render content
              try {
                showInfoDetail(key, magicTitle, contentEl);
              } catch (e) {}
            }
          }
        } catch (e) {}
      } catch (e) {}

      try {
        showCustomAlert("チェンジを適用しました");
      } catch (e) {
        try {
          window.alert("チェンジを適用しました");
        } catch (e2) {}
      }
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
  }
}
