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
import { TILE, allInfo, START_FLOOR, playerState } from "../core/constants.js";
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
      case 2:
        showCustomAlert("壁に何か文字が刻まれている...");
        break;
      case TILE.INFO_SNAKE_G:
        if (!allInfo.info_snake_g.unlocked) {
          allInfo.info_snake_g.unlocked = true;
          mapService.setTile(x, y, 0);
          showCustomAlert(`${allInfo.info_snake_g.title}を入手した`);
        } else {
          showCustomAlert(`既に${allInfo.info_snake_g.title}は入手している。`);
        }
        break;
      case TILE.INFO_STATUE:
        if (!allInfo.info_statue.unlocked) {
          allInfo.info_statue.unlocked = true;
          mapService.setTile(x, y, 0);
          showCustomAlert(`${allInfo.info_statue.title}を入手した`);
        } else {
          showCustomAlert(`既に${allInfo.info_statue.title}は入手している。`);
        }
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
      case TILE.BOX_3F:
        if (!playerState.gotMoveMagic) {
          playerState.gotMoveMagic = true;
          mapService.setTile(x, y, 0);
          showCustomAlert("魔法「ムーブ」を入手した。冊子６ページを開こう。");
        } else {
          showCustomAlert("既に魔法「ムーブ」は入手している。");
        }
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
      const player = window.__playerInstance;
      const x = player ? player.gridX : null;
      const y = player ? player.gridY : null;
      const floor = player ? player.floor : null;

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
        // open modal to get statue name and direction
        openMoveModal();
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
      const normalizedAccepted = accepted.map((a) => normalize(a));
      const isElevatorSpell = normalizedAccepted.includes(raw);

      if (isElevatorSpell) {
        // only allow 1F -> 2F when standing on magic tile (5,5) on 1F
        if (floor === 1 && x === 5 && y === 5) {
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
      } else {
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
        showCustomAlert("入力が正しくないようだ");
        return;
      }
      // find statue_j in statues list
      const s = statues.find((st) => st.nameKey === "statue_j");
      if (!s) {
        showCustomAlert("その像は見つからないようだ");
        return;
      }
      // direction vector
      const dirMap = { 東: [1, 0], 西: [-1, 0], 南: [0, 1], 北: [0, -1] };
      const vec = dirMap[dir];
      if (!vec) {
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
