import {
  handleGetPuzzlePiece,
  renderPuzzleSetList,
} from "../managers/puzzleManager.js";
import {
  openInfoModal,
  closeInfoModal,
  showInfoDetail,
  initInfoModalHandlers,
} from "../managers/infoManager.js";
import {
  showCustomAlert,
  openPuzzleModal,
  closePuzzleModal,
} from "./modals.js";
import { TILE, allInfo, START_FLOOR } from "../core/constants.js";
// import { startTimer as startTimerCore } from "./timer.js";
import Player from "../entities/player.js";
import { initEngine, getApp } from "../core/engine.js";
import { loadAssets } from "../core/assets.js";
import { START_POS_X, START_POS_Y } from "../core/constants.js";
import * as mapService from "../managers/mapService.js";
import { on } from "../core/eventBus.js";

export async function setupUI() {
  const app = initEngine();
  // ensure mapService is set to the desired start floor before loading the map image
  try {
    mapService.setFloor(START_FLOOR);
  } catch (e) {}
  await loadAssets([mapService.getMapImage(), "img/character.png"]);
  // create map sprite from explicit start floor image to avoid race with later events
  const mapSprite = PIXI.Sprite.from(mapService.getMapImage(START_FLOOR));
  mapSprite.width = app.screen.width;
  mapSprite.height = app.screen.height;
  app._layers.mapLayer.addChild(mapSprite);

  // listen for floor change events to update background image
  on("floorChanged", (floor) => {
    try {
      const img = mapService.getMapImage(floor);
      mapSprite.texture = PIXI.Texture.from(img);
      mapSprite.width = app.screen.width;
      mapSprite.height = app.screen.height;
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

  // expose helper for testing teleports across floors
  window.teleportPlayer = (x, y, floor) => {
    try {
      player.teleport(x, y, floor);
    } catch (e) {
      console.log("teleportPlayer failed", e);
    }
  };

  // setup DOM hooks
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
    const onPointerUp = (e) => {
      const now = Date.now();
      if (now - lastMoveTime < POINTER_DEBOUNCE_MS) return;
      lastMoveTime = now;
      suppressClickUntil = now + CLICK_SUPPRESS_MS;
      player.move(b.dx, b.dy);
    };
    btn.addEventListener("pointerup", onPointerUp, { passive: false });
    btn.addEventListener("click", (e) => {
      if (Date.now() < suppressClickUntil) {
        e.preventDefault();
        return;
      }
      player.move(b.dx, b.dy);
    });
  });

  function handleActionEvent() {
    if (!player) return;
    const x = player.gridX;
    const y = player.gridY;
    const currentTileType = mapService.getTile(x, y);

    switch (currentTileType) {
      case 2:
        showCustomAlert("壁に何か文字が刻まれている...");
        break;
      case TILE.INFO_HOLE:
        if (!allInfo.about_hole.unlocked) {
          showCustomAlert("「穴について」の情報を得た。");
          allInfo.about_hole.unlocked = true;
        } else {
          showCustomAlert("既に「穴について」の情報は得ている。");
        }
        break;
      case TILE.INFO_SNAKE:
        if (!allInfo.info_snake.unlocked) {
          allInfo.info_snake.unlocked = true;
          mapService.setTile(x, y, 0);
          showCustomAlert(`${allInfo.info_snake.title}を入手した`);
        } else {
          showCustomAlert(`既に${allInfo.info_snake.title}は入手している。`);
        }
        break;
      case TILE.INFO_IMG:
        if (!allInfo.info_img.unlocked) {
          allInfo.info_img.unlocked = true;
          mapService.setTile(x, y, 0);
          showCustomAlert(`${allInfo.info_img.title}を入手した`);
        } else {
          showCustomAlert(`既に${allInfo.info_img.title}は入手している。`);
        }
        break;
      case TILE.BOX_1F:
        showCustomAlert("魔法「エレベ」を入手した。冊子4ページを開こう");
        mapService.setTile(x, y, 0);
        break;
      case TILE.PUZZLE_1H:
      case TILE.PUZZLE_1S:
      case TILE.PUZZLE_1C:
      case TILE.PUZZLE_1D:
        handleGetPuzzlePiece("elevator_1f", currentTileType, { x, y });
        break;
      case TILE.PUZZLE_2H:
        // ハートの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert("ハートの謎を入手した。");
        break;
      case TILE.PUZZLE_2D:
        // ダイヤの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert("ダイヤの謎を入手した。");
        break;
      case TILE.PUZZLE_2S:
        // スペードの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert("スペードの謎を入手した。");
        break;
      case TILE.PUZZLE_2C:
        // クローバーの謎
        handleGetPuzzlePiece(
          "elevator_2f",
          currentTileType,
          { x, y },
          { suppressAlert: true }
        );
        showCustomAlert("クローバーの謎を入手した。");
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
      keywordModal.style.display = "flex";
    });
    const kbClose = keywordModal.querySelector(".close-btn");
    if (kbClose)
      kbClose.addEventListener(
        "click",
        () => (keywordModal.style.display = "none")
      );
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
      // simple matching: accept any of accepted entries (case/width insensitive not fully handled)
      const ok = accepted.some((a) => raw === normalize(a));
      const player = window.__playerInstance;
      const x = player ? player.gridX : null;
      const y = player ? player.gridY : null;

      // debug info: always log and show a debug alert so user can see what's happening
      console.log(
        "[magic] input=",
        magicInput.value,
        "normalized=",
        raw,
        "match=",
        ok,
        "player=",
        x,
        y
      );

      if (ok && x === 5 && y === 5) {
        try {
          teleportPlayer(5, 5, 2);
          showCustomAlert(
            "「エレべ」を唱え、1Fから2Fに移動した。封筒Aを開こう"
          );
        } catch (e) {
          try {
            window.alert("魔法が唱えられた！正解です。");
          } catch (e2) {}
        }
      } else if (!ok) {
        // 入力自体が間違っている場合
        const msg = "呪文が正しくないようだ";
        console.log("[magic] wrong-spell:", raw);
        try {
          showCustomAlert(msg);
        } catch (e) {
          try {
            window.alert(msg);
          } catch (e2) {}
        }
      } else {
        // 入力は正しいが場所が違う場合
        const msg = "正しい魔法陣の上で唱えよう";
        console.log("[magic] correct-spell-wrong-place: player=", x, y);
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
    if (timerElement) timerElement.textContent = `TIME ${min}:${sec}`;
  }, 1000);
}
