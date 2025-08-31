// --- グローバル定数 ---
const TILE_SIZE = 40;
const MAP_WIDTH = 11;
const MAP_HEIGHT = 11;

const TILE = {
  FLOOR: 0,
  WALL: 1,
  INFO_MSG: 2,
  INFO_HOLE: "info_hole", // 文字列として定義
  HOLE: "hole", // ▼▼▼ 追加 ▼▼▼
  PUZZLE_1H: "puzzle_1h",
  PUZZLE_1S: "puzzle_1s",
  PUZZLE_1C: "puzzle_1c",
  PUZZLE_1D: "puzzle_1d",
};
const mapData = [
  // x: 0  1  2  3  4  5  6  7  8  9  10
  /*y=0*/ [0, "hole", 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=1*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=2*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=3*/ [0, 0, 0, 0, 0, 0, 0, 0, "hole", 0, 0],
  /*y=4*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, "hole"],
  /*y=5*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  /*y=6*/ ["puzzle_1c", 0, "puzzle_1d", 1, 0, 0, 0, 1, 0, 0, 0],
  /*y=7*/ [0, 0, 0, 1, 1, 1, 1, 1, 0, "hole", 0],
  /*y=8*/ [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  /*y=9*/ [0, 0, 0, 1, 0, 0, 0, 0, 0, "info_hole", 0],
  /*y=10*/ ["puzzle_1h", 0, "puzzle_1s", 1, 0, 0, 0, 0, 0, 0, 0],
];

const allInfo = {
  about_hole: {
    title: "穴について",
    content:
      "穴に落ちると真下に落ちて死んでしまう。（死亡した場合、直近でそのフロアに到達した位置に戻される）落ちないように注意しよう。",
    unlocked: false,
  },

  // 今後ここに情報を追加していく
};
const allPuzzles = {
  elevator_1f: {
    title: "謎|エレベ1F",
    unlocked: false,
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
    pieces: [
      {
        id: TILE.PUZZLE_1H,
        image: "img/nazo/1f_heart.png",
        unlocked: false,
        answers: ["ぱーる"],
      },
      {
        id: TILE.PUZZLE_1S,
        image: "img/nazo/1f_spade.png",
        unlocked: false,
        answers: ["きんく"],
      },
      {
        id: TILE.PUZZLE_1C,
        image: "img/nazo/1f_clover.png",
        unlocked: false,
        answers: ["じにん"],
      },
      {
        id: TILE.PUZZLE_1D,
        image: "img/nazo/1f_diamond.png",
        unlocked: false,
        answers: ["いりえ"],
      },
    ],
  },
};
const START_POS_X = 5;
const START_POS_Y = 10;
// =======================================================================
// ▼▼▼ 設計図（クラス）の定義 ▼▼▼
// =======================================================================

/**
 * @class GameObject
 * @description マップ上のすべてのオブジェクト（プレイヤー、敵、アイテム等）の基本となるクラス
 */
class GameObject {
  constructor(x, y, texture) {
    this.gridX = x;
    this.gridY = y;
    this.sprite = PIXI.Sprite.from(texture);
    this.sprite.width = TILE_SIZE;
    this.sprite.height = TILE_SIZE;
    this.updatePixelPosition();
  }

  // グリッド座標を元に、スプライトのピクセル位置を更新
  updatePixelPosition() {
    this.sprite.x = this.gridX * TILE_SIZE;
    this.sprite.y = this.gridY * TILE_SIZE;
  }
}

/**
 * @class Player
 * @description プレイヤーを操作するためのクラス (GameObjectを継承)
 */
class Player extends GameObject {
  constructor(x, y, texturePath) {
    super(x, y, texturePath);

    this.direction = "down"; // 初期方向

    // ▼▼▼ 追加 ▼▼▼
    this.animationFrame = 0; // アニメーションの現在のコマ (0-3)

    // スプライトシートから全アニメーションフレームのテクスチャを準備
    this.textures = this.prepareTextures(texturePath);

    // 初期テクスチャを立ちポーズ（各方向の0番目のフレーム）に設定
    this.sprite.texture = this.textures[this.direction][0];
  }
  teleport(x, y) {
    this.gridX = x;
    this.gridY = y;
    this.updatePixelPosition();
    // 向きを初期化し、立ちポーズに戻す
    this.direction = "down";
    this.animationFrame = 0;
    this.sprite.texture = this.textures[this.direction][0];
  }
  // ▼▼▼ 修正 ▼▼▼
  // スプライトシートから全16フレームを読み込むように修正
  prepareTextures(texturePath) {
    const textures = {
      down: [],
      up: [],
      right: [],
      left: [],
    };
    const baseTexture = PIXI.Texture.from(texturePath).baseTexture;

    // スプライトシートの行と方向のマッピング
    const directionOrder = ["down", "up", "right", "left"];
    const frameWidth = 16; // この画像の1コマの幅
    const frameHeight = 16; // この画像の1コマの高さ

    // 4方向 x 4コマ = 16フレームを全て切り出す
    for (let y = 0; y < 4; y++) {
      // 4方向 (行)
      const direction = directionOrder[y];
      for (let x = 0; x < 4; x++) {
        // 4コマ (列)
        const frame = new PIXI.Rectangle(
          x * frameWidth,
          y * frameHeight,
          frameWidth,
          frameHeight
        );
        textures[direction].push(new PIXI.Texture(baseTexture, frame));
      }
    }
    return textures;
  }
  // ▲▲▲ 修正 ▲▲▲

  // 移動処理
  move(dx, dy) {
    // 向きの更新
    if (dy > 0) this.direction = "down";
    else if (dy < 0) this.direction = "up";
    else if (dx < 0) this.direction = "left";
    else if (dx > 0) this.direction = "right";

    const newX = this.gridX + dx;
    const newY = this.gridY + dy;

    // マップ範囲外なら何もしない
    const isInBounds =
      newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT;
    if (!isInBounds) {
      this.animationFrame = 0; // 壁にぶつかった時と同様に立ちポーズに
      this.sprite.texture = this.textures[this.direction][0];
      return;
    }

    const targetTile = mapData[newY][newX];

    // 移動先のマスの種類によって処理を分岐
    switch (targetTile) {
      case TILE.HOLE:
        // 穴に落ちた場合
        alert("うわー！穴に落ちてしまった！");
        this.teleport(START_POS_X, START_POS_Y); // スタート地点に戻る
        break;

      case TILE.WALL:
        // 壁にぶつかった場合
        this.animationFrame = 0; // 立ちポーズに戻す
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        break;

      default:
        // それ以外（床など）の場合は通常通り移動
        this.gridX = newX;
        this.gridY = newY;
        this.updatePixelPosition();

        // アニメーションを1コマ進める
        this.animationFrame = (this.animationFrame + 1) % 4;
        this.sprite.texture =
          this.textures[this.direction][this.animationFrame];
        break;
    }
  }
}

// =======================================================================
// ▼▼▼ ゲーム全体の管理 ▼▼▼
// =======================================================================

const app = new PIXI.Application({
  width: TILE_SIZE * MAP_WIDTH,
  height: TILE_SIZE * MAP_HEIGHT,
  backgroundColor: 0x000000,
});
document.getElementById("game-canvas").appendChild(app.view);

let player;

async function setupGame() {
  await PIXI.Assets.load(["img/map/map_1f.jpg", "img/character.png"]);

  const mapSprite = PIXI.Sprite.from("img/map/map_1f.jpg");
  mapSprite.width = app.screen.width;
  mapSprite.height = app.screen.height;
  app.stage.addChild(mapSprite);

  // ▼▼▼ 修正 ▼▼▼
  // スタート位置をマップ中央に直接設定
  const startPos = {
    x: START_POS_X,
    y: START_POS_Y,
  };
  // ▲▲▲ 修正 ▲▲▲

  player = new Player(startPos.x, startPos.y, "img/character.png");
  app.stage.addChild(player.sprite);

  setupUI();
  startTimer();
}

function setupUI() {
  document
    .getElementById("up-btn")
    .addEventListener("click", () => player.move(0, -1));
  document
    .getElementById("down-btn")
    .addEventListener("click", () => player.move(0, 1));
  document
    .getElementById("left-btn")
    .addEventListener("click", () => player.move(-1, 0));
  document
    .getElementById("right-btn")
    .addEventListener("click", () => player.move(1, 0));

  document
    .getElementById("action-a-btn")
    .addEventListener("click", handleActionEvent);

  const keywordModal = document.getElementById("keyword-modal");
  document.getElementById("item-btn").addEventListener("click", () => {
    keywordModal.style.display = "flex";
  });
  keywordModal.querySelector(".close-btn").addEventListener("click", () => {
    keywordModal.style.display = "none";
  });

  // ▼▼▼ 追加：謎ボタンを開くハンドラ ▼▼▼
  const puzzleBtn = document.getElementById("puzzle-btn");
  if (puzzleBtn) {
    puzzleBtn.addEventListener("click", () => {
      // openPuzzleModal は関数宣言なのでここで参照して問題ありません
      openPuzzleModal();
    });
  }
  // ▲▲▲ 追加ここまで ▲▲▲
}

function handleActionEvent() {
  if (!player) return;

  const x = player.gridX;
  const y = player.gridY;
  const currentTileType = mapData[y][x];

  console.log(
    `Aボタンが押されました。場所: (${x}, ${y}), マスの種類: ${currentTileType}`
  );

  switch (currentTileType) {
    case 2:
      alert("壁に何か文字が刻まれている...");
      break;
    case TILE.INFO_HOLE:
      // 「穴について」の情報を解放する
      if (!allInfo.about_hole.unlocked) {
        alert("「穴について」の情報を得た。");
        allInfo.about_hole.unlocked = true;
      } else {
        alert("既に「穴について」の情報は得ている。");
      }
      break;
    case TILE.PUZZLE_1H:
    case TILE.PUZZLE_1S:
    case TILE.PUZZLE_1C:
    case TILE.PUZZLE_1D:
      handleGetPuzzlePiece("elevator_1f", currentTileType);
      break;
    default:
      break;
  }
}
function handleGetPuzzlePiece(setId, pieceId) {
  const puzzleSet = allPuzzles[setId];
  const puzzlePiece = puzzleSet.pieces.find((p) => p.id === pieceId);

  if (puzzlePiece && !puzzlePiece.unlocked) {
    puzzlePiece.unlocked = true;
    alert("謎のかけらを手に入れた！");

    // このセットで初めてのかけら入手なら、セット自体を解放する
    if (!puzzleSet.unlocked) {
      puzzleSet.unlocked = true;
    }
    // マップ上のタイルを通常の床に戻す（再入手不可にする）
    mapData[player.gridY][player.gridX] = TILE.FLOOR;
  }
}

function startTimer() {
  let seconds = 0;
  const timerElement = document.getElementById("timer");
  setInterval(() => {
    seconds++;
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = (seconds % 60).toString().padStart(2, "0");
    timerElement.textContent = `TIME ${min}:${sec}`;
  }, 1000);
}

setupGame();

const infoModal = document.getElementById("info-modal");
const infoPage1 = document.getElementById("info-page-1");
const infoPage2 = document.getElementById("info-page-2");
const infoList = document.getElementById("info-list");
const infoDetailTitle = document.getElementById("info-detail-title");
const infoDetailContent = document.getElementById("info-detail-content");

// --- 表示制御 ---
function openInfoModal() {
  renderInfoList(); // リストを最新の状態に更新
  infoPage1.style.display = "block";
  infoPage2.style.display = "none";
  infoModal.style.display = "flex";
}

function closeInfoModal() {
  infoModal.style.display = "none";
}

function showInfoDetail(infoKey) {
  const info = allInfo[infoKey];
  if (!info) return;

  infoDetailTitle.textContent = info.title;
  infoDetailContent.textContent = info.content;

  infoPage1.style.display = "none";
  infoPage2.style.display = "block";
}

function showInfoList() {
  infoPage1.style.display = "block";
  infoPage2.style.display = "none";
}

// --- リストの描画 ---
function renderInfoList() {
  // 一旦リストを空にする
  infoList.innerHTML = "";

  // allInfoオブジェクトをループして、解放済みの情報だけをリストに追加
  for (const key in allInfo) {
    if (allInfo[key].unlocked) {
      const info = allInfo[key];
      const li = document.createElement("li");
      li.textContent = info.title;
      li.dataset.key = key; // クリックされた時にどの情報か識別するためのキー
      infoList.appendChild(li);
    }
  }
}

// --- イベントリスナーの設定 ---
// 「情報」ボタンが押されたとき
document.getElementById("info-btn").addEventListener("click", openInfoModal);

// モーダルの閉じるボタン
document
  .getElementById("info-close-btn")
  .addEventListener("click", closeInfoModal);

// 詳細画面の戻るボタン
document
  .getElementById("info-back-btn")
  .addEventListener("click", showInfoList);

// 情報リストの項目がクリックされたとき (イベント委任)
infoList.addEventListener("click", (event) => {
  if (event.target.tagName === "LI") {
    const key = event.target.dataset.key;
    showInfoDetail(key);
  }
});
// game.js の下部に追加

// =======================================================================
// ▼▼▼ 謎モーダル機能 ▼▼▼
// =======================================================================

const puzzleModal = document.getElementById("puzzle-modal");
const puzzlePage1 = document.getElementById("puzzle-page-1");
const puzzlePage2 = document.getElementById("puzzle-page-2");
const puzzleSetList = document.getElementById("puzzle-set-list");
const puzzleGridTitle = document.getElementById("puzzle-grid-title");
const puzzleBackBtn = document.getElementById("puzzle-back-btn");
const puzzleCloseBtn = document.getElementById("puzzle-close-btn");
// 追加: グリッド要素を取得（必須）
const puzzleGrid = document.getElementById("puzzle-grid");

function openPuzzleModal() {
  if (!puzzleModal) return;
  puzzleModal.style.display = "flex";
  // show list page by default
  if (puzzlePage1) puzzlePage1.style.display = "block";
  if (puzzlePage2) puzzlePage2.style.display = "none";
  renderPuzzleSetList();
}

function closePuzzleModal() {
  if (!puzzleModal) return;
  puzzleModal.style.display = "none";
  // ensure returning to page1 next time
  if (puzzlePage1) puzzlePage1.style.display = "block";
  if (puzzlePage2) puzzlePage2.style.display = "none";
}

function renderPuzzleSetList() {
  if (!puzzleSetList) return;
  puzzleSetList.innerHTML = "";
  Object.keys(allPuzzles).forEach((setId) => {
    const set = allPuzzles[setId];
    const li = document.createElement("li");
    li.textContent = set.title || setId;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      openPuzzleSet(setId);
    });
    puzzleSetList.appendChild(li);
  });
}

function openPuzzleSet(setId) {
  const set = allPuzzles[setId];
  if (!set) return;
  if (puzzleGridTitle) puzzleGridTitle.textContent = set.title || setId;
  if (puzzlePage1) puzzlePage1.style.display = "none";
  if (puzzlePage2) puzzlePage2.style.display = "flex";
  // render pieces into #puzzle-grid (renderPuzzleGrid must exist)
  if (typeof renderPuzzleGrid === "function") renderPuzzleGrid(set);

  // 下部画像の切り替え（set.bottomImages が配列なら2枚表示、なければ非表示）
  const bottomWrap = document.getElementById("puzzle-bottom-images");
  const bottom1 = document.getElementById("puzzle-bottom-1");
  const bottom2 = document.getElementById("puzzle-bottom-2");
  if (bottomWrap && bottom1 && bottom2) {
    if (Array.isArray(set.bottomImages) && set.bottomImages.length >= 2) {
      bottom1.src = set.bottomImages[0] || "";
      bottom2.src = set.bottomImages[1] || "";
      bottomWrap.style.display = "flex";
    } else {
      // 非表示にして src をクリア（不要ならクリアを省略）
      bottom1.src = "";
      bottom2.src = "";
      bottomWrap.style.display = "none";
    }
  }
}

function renderPuzzleGrid(puzzleSet) {
  if (!puzzleGrid) return;
  puzzleGrid.innerHTML = "";

  puzzleSet.pieces.forEach((piece) => {
    const pieceEl = document.createElement("div");
    pieceEl.classList.add("puzzle-piece");
    const img = document.createElement("img");
    img.alt = piece.id;

    if (piece.solvedAnswer) {
      // 正解済み -> 実画像を表示してグレーアウト（solved）
      img.src = piece.image;
      pieceEl.classList.add("solved");
      pieceEl.classList.remove("locked");
      pieceEl.style.pointerEvents = ""; // 再タップで確認表示するため有効
      // クリックで popup を開き、入力は固定（showPuzzlePopup で制御）
      pieceEl.addEventListener("click", () => {
        if (puzzleModal && puzzleModal.style.display === "none") return;
        showPuzzlePopup(piece, puzzleSet);
      });
    } else if (piece.unlocked) {
      // 取得済みだが未解答 -> 実画像を表示（通常表示）、クリックで入力可能
      img.src = piece.image;
      pieceEl.classList.remove("solved");
      pieceEl.classList.remove("locked");
      pieceEl.style.pointerEvents = ""; // 有効にする
      pieceEl.addEventListener("click", () => {
        if (puzzleModal && puzzleModal.style.display === "none") return;
        showPuzzlePopup(piece, puzzleSet);
      });
    } else {
      // 未取得（ロック） -> ロック画像、クリック不可
      img.src = "img/nazo_locked.png";
      pieceEl.classList.add("locked");
      pieceEl.classList.remove("solved");
      pieceEl.style.pointerEvents = "none";
    }

    pieceEl.appendChild(img);
    puzzleGrid.appendChild(pieceEl);
  });
}

// ボタンイベント（存在チェックしてから追加）
if (puzzleBackBtn) {
  puzzleBackBtn.addEventListener("click", () => {
    if (puzzlePage2) puzzlePage2.style.display = "none";
    if (puzzlePage1) puzzlePage1.style.display = "block";
  });
}
if (puzzleCloseBtn) {
  puzzleCloseBtn.addEventListener("click", closePuzzleModal);
}

// popup 用の静的 DOM 参照 (index.html に追加済みの要素)
const popupOverlay = document.getElementById("puzzle-popup-overlay");
const popupImage = document.getElementById("puzzle-popup-image");
const popupInput = document.getElementById("puzzle-popup-input");
const popupSubmit = document.getElementById("puzzle-popup-submit");
const popupClose = document.getElementById("puzzle-popup-close");

let _currentPiece = null;
let _currentSet = null;

function showPuzzlePopup(piece, puzzleSet) {
  _currentPiece = piece;
  _currentSet = puzzleSet;
  if (!popupOverlay) return;

  // 画像をセット（解放済みであれば実画像）
  popupImage.src = piece.image || "";
  popupImage.alt = piece.id || "";

  // 正解済み(保存済み)の挙動：入力に保存値セットして編集不可・送信不可にする
  if (piece.solvedAnswer) {
    popupInput.value = piece.solvedAnswer;
    popupInput.disabled = true;
    if (popupSubmit) popupSubmit.disabled = true;
  } else {
    // 未保存（ただ解放済みだが未回答保存の場合）は空欄で編集可能（用途に応じて）
    popupInput.value = "";
    popupInput.disabled = false;
    if (popupSubmit) popupSubmit.disabled = false;
  }

  popupOverlay.style.display = "flex";
  // フォーカスは入力が編集可能な場合のみ
  if (!popupInput.disabled) popupInput.focus();
}

function closePuzzlePopup() {
  if (!popupOverlay) return;
  popupOverlay.style.display = "none";
  _currentPiece = null;
  _currentSet = null;
}

// 送信ボタンのクリック処理（バリデーション）
if (popupSubmit) {
  popupSubmit.addEventListener("click", () => {
    if (!_currentPiece || !_currentSet) return;

    // 既に確定済みなら無視（安全措置）
    if (_currentPiece.solvedAnswer) return;

    const raw = (popupInput.value || "").trim();
    const val = raw.toLowerCase();
    const answers = (_currentPiece.answers || []).map((a) =>
      a.trim().toLowerCase()
    );
    const isValid = answers.some((a) => a === val);

    if (isValid) {
      // 正解処理
      _currentPiece.unlocked = true;
      _currentPiece.solvedAnswer = raw; // 表示向けに原文保存
      if (!_currentSet.unlocked) _currentSet.unlocked = true;

      // UI更新：グリッド再描画してグレーアウトを反映
      renderPuzzleGrid(_currentSet);

      alert("正解！ピースを確定しました。");
      closePuzzlePopup();
    } else {
      alert("不正解です。もう一度試してください。");
    }
  });
}

// クリックで閉じるハンドラ（閉じるボタン / オーバーレイ）
if (popupClose) {
  popupClose.addEventListener("click", closePuzzlePopup);
}

if (popupOverlay) {
  popupOverlay.addEventListener("click", (e) => {
    // モーダル外（オーバーレイ部分）をクリックしたときだけ閉じる
    if (e.target === popupOverlay) closePuzzlePopup();
  });
}

// --- IME / Enter 制御: composition を使って確定前の Enter を無視する ---
let isComposing = false;
let lastCompositionEnd = 0;

if (popupInput) {
  popupInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  popupInput.addEventListener("compositionend", () => {
    // IME 確定直後に発生する Enter を無視するためタイムスタンプを保持
    lastCompositionEnd = Date.now();
    // composition フラグはすぐに解除しておく（安全のため短時間チェックも行う）
    isComposing = false;
  });

  // Enter キー処理 — IME 中 / 確定直後は送信しない
  popupInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const now = Date.now();
    // IME 確定直後 (例: 200ms以内) または composition 中は送信を無視
    if (isComposing || now - lastCompositionEnd < 200) {
      e.preventDefault();
      return;
    }

    // 正常な Enter（確定済み）であれば送信
    e.preventDefault();
    popupSubmit && popupSubmit.click();
  });
}
