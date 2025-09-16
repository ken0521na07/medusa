export const TILE_SIZE = 40;
export const MAP_WIDTH = 11;
export const MAP_HEIGHT = 11;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  INFO_MSG: 2,
  INFO_HOLE: "info_hole",
  INFO_SNAKE: "info_snake",
  INFO_SNAKE_G: "info_snake_g",
  INFO_IMG: "info_img",
  INFO_STATUE: "info_statue",
  HOLE: "hole",
  SNAKE: "snake",
  SNAKE_BOUNCE: "snake_bounce",
  BOX_1F: "box_1f",
  BOX_3F: "box_3f",
  PUZZLE_1H: "puzzle_1h",
  PUZZLE_1S: "puzzle_1s",
  PUZZLE_1C: "puzzle_1c",
  PUZZLE_1D: "puzzle_1d",
  PUZZLE_2H: "puzzle_2h",
  PUZZLE_2S: "puzzle_2s",
  PUZZLE_2C: "puzzle_2c",
  PUZZLE_2D: "puzzle_2d",
  PUZZLE_3: "puzzle_3",
  STATUE_J: "statue_j",
  MOVE: "move",
  CHANGE: "change",
};

// --- フロア別マップ定義 ---
// 1F のマップ（既存）
const MAP_1F = [
  /*y=0*/ [0, "hole", 0, 0, 0, "box_1f", 0, 0, 0, 0, 0],
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

// 2F の仮マップ（現時点では全て床にする）
const MAP_2F = [
  ["puzzle_2s", 0, 0, 0, 0, 0, 0, 0, "snake", 0, "puzzle_2d"],
  [0, 0, 0, "snake", 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, "hole", 0, "info_snake", 0, 0, 0, "snake", 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ["snake", 0, 0, 0, 0, 0, 0, "snake", 0, 1, 0],
  [0, 0, "hole", 0, 0, 0, "snake", 0, "snake", 0, 0],
  [1, 0, 0, 0, 0, 0, 0, "snake", 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, "snake", 0, "info_img", 0, 0, 0, 0, 0],
  [0, "snake", 0, 0, 0, 0, 0, 0, 0, 0, "snake"],
  ["puzzle_2h", "hole", 0, 0, "snake", 1, 0, "hole", 0, 0, "puzzle_2c"],
];

// 3F の仮マップ（蛇が往復するエリアを含める）
const MAP_3F = [
  ["snake", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ["snake", 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  ["snake", 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  ["snake", 0, 0, 0, 1, "info_snake_g", 0, "snake_bounce", 1, "box_3f", 0],
  ["snake", 0, 0, 0, 1, 0, 0, "snake_bounce", 1, 0, 0],
  [0, "statue_j", 0, "puzzle_3", 1, 0, 0, "snake_bounce", 1, "move", 0],
  ["snake", 0, 0, 0, 1, 0, 0, "snake_bounce", 1, 0, 0],
  ["snake", 0, 0, 0, 1, "info_statue", 0, "snake_bounce", 1, 0, 0],
  ["snake", 0, 0, 1, 0, 0, 0, "snake_bounce", 1, 0, "snake_bounce"],
  ["snake", 0, 1, 0, 0, 0, 0, 0, 0, 0, "snake_bounce"],
  ["snake", 0, 0, 0, 0, "change", 0, 1, 0, 0, "snake_bounce"],
];

export const MAPS = {
  1: MAP_1F,
  2: MAP_2F,
  3: MAP_3F,
};

// 元の状態を保持するコピー（フロア毎）
export const ORIGINAL_MAPS = Object.fromEntries(
  Object.entries(MAPS).map(([k, v]) => [k, v.map((r) => r.slice())])
);

// マップ画像パス（フロア毎）
export const MAP_IMAGES = {
  1: "img/map/map_1f.jpg",
  2: "img/map/map_2f.jpg",
  3: "img/map/map_3f.jpg",
};

export const allInfo = {
  about_hole: {
    title: "穴について",
    content:
      "穴に落ちると真下に落ちて死んでしまう。（死亡した場合、直近でそのフロアに到達した位置に戻される）落ちないように注意しよう。",
    unlocked: false,
  },
  info_snake: {
    title: "蛇の情報",
    content:
      "視線の直線上に蛇がいると、石化して死んでしまう。蛇を見ないように気をつけよう。",
    unlocked: false,
  },
  info_img: {
    title: "謎について",
    // content will be handled as image reference; store image path here
    content: "img/info_img.png",
    unlocked: false,
  },
};

export const allPuzzles = {
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
  elevator_2f: {
    title: "謎|2F",
    unlocked: false,
    bottomImages: [],
    pieces: [
      {
        id: TILE.PUZZLE_2H,
        image: "img/nazo/2f_heart.png",
        unlocked: false,
        answers: ["えーる"],
      },
      {
        id: TILE.PUZZLE_2S,
        image: "img/nazo/2f_spade.png",
        unlocked: false,
        answers: ["ぞうに"],
      },
      {
        id: TILE.PUZZLE_2C,
        image: "img/nazo/2f_clover.png",
        unlocked: false,
        answers: ["うまみ"],
      },
      {
        id: TILE.PUZZLE_2D,
        image: "img/nazo/2f_diamond.png",
        unlocked: false,
        answers: ["いけん"],
      },
    ],
  },
};

export const START_POS_X = 5;
export const START_POS_Y = 5; // changed from 10 to 5 to start at y=5
export const START_FLOOR = 1; // start on 1F by default
