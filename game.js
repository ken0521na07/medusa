// --- グローバル定数 ---
const TILE_SIZE = 40;
const MAP_WIDTH = 11;
const MAP_HEIGHT = 11;

// --- マップデータ ---
// ▼▼▼ 修正 ▼▼▼
// 0: 通行可能, 1: 通行不可(壁)
const mapData = [
  // x: 0  1  2  3  4  5  6  7  8  9  10
  /*y=0*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=1*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=2*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=3*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=4*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  /*y=5*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  /*y=6*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  /*y=7*/ [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  /*y=8*/ [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  /*y=9*/ [0, 0, 0, 1, 0, 0, 0, 0, 0, "info_hole", 0],
  /*y=10*/ [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
];

const allInfo = {
  about_hole: {
    title: "穴について",
    content: "穴に落ちると死んでしまう。注意深く進もう。",
    unlocked: false,
  },

  // 今後ここに情報を追加していく
};

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
    // ▲▲▲ 追加 ▲▲▲

    // スプライトシートから全アニメーションフレームのテクスチャを準備
    this.textures = this.prepareTextures(texturePath);

    // 初期テクスチャを立ちポーズ（各方向の0番目のフレーム）に設定
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
    // ▼▼▼ 修正 ▼▼▼
    let moved = false; // 実際に移動したかを判定するフラグ

    // 向きの更新
    if (dy > 0) this.direction = "down";
    else if (dy < 0) this.direction = "up";
    else if (dx < 0) this.direction = "left";
    else if (dx > 0) this.direction = "right";

    const newX = this.gridX + dx;
    const newY = this.gridY + dy;

    const isInBounds =
      newX >= 0 && newX < MAP_WIDTH && newY >= 0 && newY < MAP_HEIGHT;
    if (isInBounds && mapData[newY][newX] !== 1) {
      // 壁でなければ移動
      this.gridX = newX;
      this.gridY = newY;
      this.updatePixelPosition();
      moved = true;
    }

    // 移動した場合のみアニメーションを1コマ進める
    if (moved) {
      this.animationFrame = (this.animationFrame + 1) % 4; // 0, 1, 2, 3のループ
    } else {
      // 壁にぶつかった場合などは立ちポーズに戻す
      this.animationFrame = 0;
    }

    // 向きとアニメーションフレームに合わせてスプライトのテクスチャを更新
    this.sprite.texture = this.textures[this.direction][this.animationFrame];
    // ▲▲▲ 修正 ▲▲▲
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
    x: Math.floor(MAP_WIDTH / 2),
    y: Math.floor(MAP_HEIGHT / 2),
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
    case "info_hole":
      // 「穴について」の情報を解放する
      if (!allInfo.about_hole.unlocked) {
        alert("足元に深い穴が開いている...「穴について」の情報を得た。");
        allInfo.about_hole.unlocked = true;
      } else {
        alert("何度も見た深い穴だ。");
      }
      break;
    default:
      break;
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
