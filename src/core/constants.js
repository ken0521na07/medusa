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
  INFO_5_1: "info_5_1",
  INFO_5_2: "info_5_2",
  INFO_5_3: "info_5_3",
  INFO_5_4: "info_5_4",
  INFO_MEDUSA: "info_medusa",
  HOLE: "hole",
  SNAKE: "snake",
  SNAKE_BOUNCE: "snake_bounce",
  SNAKE_BOUNCE_START: "snake_bounce_start",
  SNAKE_CLOCK: "snake_clock",
  SNAKE_CLOCK_START: "snake_clock_start",
  SNAKE_UNCLOCK: "snake_unclock",
  SNAKE_UNCLOCK_START: "snake_unclock_start",
  BOX_1F: "box_1f",
  BOX_3F: "box_3f",
  BOX_CUSHION: "box_cushion",
  BOX_CHANGE: "box_change",
  BOX_MEDUSA: "box_medusa",
  PUZZLE_1H: "puzzle_1h",
  PUZZLE_1S: "puzzle_1s",
  PUZZLE_1C: "puzzle_1c",
  PUZZLE_1D: "puzzle_1d",
  PUZZLE_2H: "puzzle_2h",
  PUZZLE_2S: "puzzle_2s",
  PUZZLE_2C: "puzzle_2c",
  PUZZLE_2D: "puzzle_2d",
  PUZZLE_3: "puzzle_3",
  PUZZLE_4H: "puzzle_4h",
  PUZZLE_4S: "puzzle_4s",
  PUZZLE_4C: "puzzle_4c",
  PUZZLE_4D: "puzzle_4d",
  PUZZLE_5: "puzzle_5",
  PUZZLE_B1: "puzzle_b1",
  STATUE_J: "statue_j",
  STATUE_F: "statue_f",
  STATUE_NOMOVE: "statue_nomove",
  STATUE_M: "statue_m",
  MOVE: "move",
  CHANGE: "change",
  CUSHON: "cushion",
  MEDUSA: "medusa",
};

// --- フロア別マップ定義 ---
// 1F のマップ（既存）
const MAP_1F = [
  /*y=0*/ [0, "hole", 0, 0, 0, "box_1f", 0, 0, 0, 0, 0],
  /*y=1*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=2*/ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  /*y=3*/ [0, 0, 0, 0, 0, 0, 0, 0, "hole", 0, 0],
  /*y=4*/ [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, "hole"],
  /*y=5*/ [0, 0, 0, 1, "elev", 0, 0, 1, 0, 0, 0],
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
  [0, 0, "hole", 0, 0, "elev", "snake", "statue_m", "snake", 0, 0],
  [1, 0, 0, 0, 0, 0, 0, "snake", 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, "snake", 0, "info_img", 0, 0, 0, 0, 0],
  [0, "snake", 0, 0, 0, 0, 0, 0, 0, 0, "snake"],
  ["puzzle_2h", "hole", 0, 0, "snake", 1, 0, "hole", 0, 0, "puzzle_2c"],
];

// 3F の仮マップ（蛇が往復するエリアを含める）
const MAP_3F = [
  ["snake", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ["snake", 0, "snake", 0, 0, 0, 0, 0, 0, 1, 0],
  ["snake", 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
  [1, 0, 0, "puzzle_3", 1, "info_snake_g", 0, "snake_bounce", 1, "box_3f", 0],
  ["snake", 0, 0, 1, 1, 0, 0, "snake_bounce", 1, 0, 0],
  ["snake", "statue_j", 0, 0, 0, "elev", 1, "snake_bounce", 1, "move", 0],
  ["snake", 0, 0, 0, 1, 0, 0, "snake_bounce", 1, 0, 0],
  ["snake", 0, 0, 0, 1, "info_statue", 0, "snake_bounce_start", 1, 0, 0],
  ["snake", 0, 0, 0, 1, 0, 0, "snake_bounce", 1, 0, "snake_bounce"],
  ["snake", 0, 0, 0, 1, 0, 0, 0, 0, 0, "snake_bounce_start"],
  ["snake", 0, 0, 0, 0, "change", 0, 1, 0, 0, "snake_bounce"],
];

// 4F の仮マップ（時計回りの snake_clock サンプルを設置）

const MAP_4F = [
  [0, 0, 0, "cushion", 0, 0, 0, "hole", 0, 0, 0],
  [0, 0, "puzzle_4d", 1, 1, 1, 1, 1, 0, 0, 0],
  [
    0,
    "snake_clock",
    "snake_clock",
    "snake_clock",
    0,
    0,
    0,
    0,
    0,
    "puzzle_4c",
    0,
  ],
  [0, "snake_clock_start", 0, "snake_clock_start", 1, 1, 0, 0, 1, 1, 1],
  [
    0,
    "snake_clock",
    1,
    "snake_clock",
    0,
    0,
    "snake_clock",
    "snake_clock",
    "snake_clock_start",
    0,
    0,
  ],
  [
    "box_change",
    "snake_clock",
    "snake_clock",
    "snake_clock",
    0,
    "elev",
    "snake_clock",
    1,
    "snake_clock",
    "hole",
    "box_cushion",
  ],
  [
    "snake_unclock",
    "snake_unclock",
    "snake_unclock",
    "snake_unclock",
    0,
    0,
    "snake_clock",
    1,
    "snake_clock",
    0,
    0,
  ],
  [
    "snake_unclock",
    0,
    1,
    "snake_unclock",
    0,
    0,
    "snake_clock",
    0,
    "snake_clock_start",
    0,
    0,
  ],
  [
    "snake_unclock_start",
    "puzzle_4s",
    1,
    "snake_unclock",
    0,
    0,
    "snake_clock",
    "snake_clock",
    "snake_clock",
    0,
    0,
  ],
  ["snake_unclock", 0, 0, "snake_unclock_start", 0, 0, 0, 0, "puzzle_4h", 0, 0],
  [
    "snake_unclock",
    "snake_unclock",
    "snake_unclock",
    "snake_unclock",
    0,
    "change",
    "hole",
    "snake_bounce",
    "snake_bounce_start",
    "snake_bounce",
    "snake_bounce",
  ],
];

// 5F explicit empty map (11x11) — written out to match style of other floors
const MAP_5F = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, "info_5_1", 0, 0, "hole", 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, "info_5_2", 0],
  [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [0, 1, "puzzle_5", 0, 0, "statue_f", 0, 0, 0, 0, "hole"],
  [0, 1, 0, 0, 0, "elev", 0, 0, 0, 0, 0],
  [0, 1, "change", 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  [0, "info_5_3", 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, "info_5_4", 0, 0],
  [0, 1, 0, 0, 0, 0, "snake", 0, 0, 1, "statue_nomove"],
];

// 6F explicit empty map (11x11)
const MAP_6F = [
  [0, "hole", 0, 1, 0, "medusa", 0, 1, 0, "hole", 0],
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, "snake", "snake", "snake", 1, 0, 0, "box_medusa"],
  [0, "cushion", 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 0, 0, 0, 1, 1, "statue_m", 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, "info_medusa", 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// B1F explicit layout with snake routes as requested. Coordinates: x=0..10, y=0..10
const MAP_B1F = [
  // y=0
  [0, 0, "puzzle_b1", 0, 0, 0, 0, 0, 0, 0, "snake"],
  // y=1
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  // y=2
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  // y=3
  [0, 0, 0, 0, 0, 0, 1, 0, "snake", 0, 0],
  // y=4
  [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
  // y=5
  [1, 0, 1, 1, 1, "elev", 1, 1, 0, 1, 1],
  // y=6  top edge of unclock rectangle (7..10), start at (8,6)
  [
    "snake",
    0,
    "snake",
    "snake",
    1,
    1,
    0,
    "snake_unclock",
    "snake_unclock_start",
    "snake_unclock",
    "snake_unclock",
  ],
  // y=7  left edge x=7 unclock, inner top row of clock at x=8..10 (start at 10,7)
  [
    "snake",
    0,
    0,
    0,
    0,
    0,
    0,
    "snake_unclock",
    "snake_clock",
    "snake_clock",
    "snake_clock_start",
  ],
  // y=8  left edge x=7 unclock, inner middle row of clock
  [
    "snake",
    0,
    0,
    0,
    0,
    0,
    0,
    "snake_unclock",
    "snake_clock",
    "snake_clock",
    "snake_clock",
  ],
  // y=9  bottom edge: unclock covers x=7..10 but clock has bottom with start at (8,9)
  [
    "snake",
    0,
    0,
    0,
    0,
    0,
    0,
    "snake_unclock",
    "snake_clock_start",
    "snake_clock",
    "snake_clock",
  ],
  // y=10
  [
    "snake",
    0,
    "snake",
    "snake",
    1,
    "snake",
    "snake",
    "snake",
    "snake",
    "snake",
    "snake",
  ],
];

export const MAPS = {
  1: MAP_1F,
  2: MAP_2F,
  3: MAP_3F,
  4: MAP_4F,
  5: MAP_5F,
  6: MAP_6F,
  0: MAP_B1F,
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
  4: "img/map/map_4f.jpg",
  5: "img/map/map_5f.jpg",
  6: "img/map/map_6f.jpg",
  0: "img/map/map_b1f.jpg",
};

export const allInfo = {
  about_hole: {
    title: "穴の情報",
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
    title: "謎の情報",
    // content will be handled as image reference; store image path here
    content: "img/info_img.png",
    unlocked: false,
  },
  info_snake_g: {
    title: "緑の（動く）蛇の情報",
    content:
      "蛇の中にはあなたの動きに合わせて移動するものが存在する。石化の判定はあなたと蛇両方が動いた後に行われる。",
    unlocked: false,
  },
  info_statue: {
    title: "像の情報",
    content:
      "石像には名前がついている。人の力では動かすことができない。石像が移動する際、経路に蛇が居ると轢き殺す。また、石像越しで蛇を見ても石化は起こらない。",
    unlocked: false,
  },

  // 5F 情報タイル: 画像として扱う
  info_5_1: {
    title: "5階の情報1",
    content: "img/info5_1.png",
    unlocked: false,
  },
  info_5_2: {
    title: "5階の情報2",
    content: "img/info5_2.png",
    unlocked: false,
  },
  info_5_3: {
    title: "5階の情報3",
    content: "img/info5_3.png",
    unlocked: false,
  },
  info_5_4: {
    title: "5階の情報4",
    content: "img/info5_4.png",
    unlocked: false,
  },

  box_1f: {
    title: "エレベ",
    content:
      "各階に指定された「エレベの呪文」を草の正しい魔法陣の上で唱えることで1つ上の階の同じ場所に移動する。",
    unlocked: true,
  },
  box_3f: {
    title: "ムーブ",
    content:
      "花の魔法陣で「ムーブの呪文」を唱え、呪文を唱えた階と同じ階にある石像の名前と、東西南北いずれかの方角を指定する。指定した方角へ、その名前の石像が5m移動する。同じ石像は1度しか動かせない。また、移動経路に壁がある場合は動かすことができない。移動経路に穴がある場合、像は真下に落下して壊れる。",
    unlocked: true,
  },
  box_cushion: {
    title: "クッショ",
    content:
      "水の正しい魔法陣の上で「クッショの呪文」を唱える。魔法陣から3歩移動する間に穴に落ちた場合、無事に真下に落ちることができる。",
    unlocked: true,
  },
  box_change: {
    title: "チェンジ",
    content:
      "火の正しい魔法陣の上で魔法を1つ指定し、指定した魔法の効果を編集したものを使用することができるようにする。編集できるのは効果の赤い文字であり、「数字を大きくする」「意味を逆にする」の2つの効果のうちどちらか、あるいは両方の効果を与えることができる。ただし、それぞれの呪文を求めるのに使用した謎に含まれる赤い文字にも同様の変化が発生し、チェンジを行った魔法を使う場合は変化後の呪文を唱える必要がある。チェンジの効果は、チェンジを使用した階で永続的に機能する。また、呪文は全て一般的な言葉になり、言葉にならない場合は使用できない。",
    unlocked: true,
  },
};

// simple runtime state that other UI code can update/query (e.g. whether
// the player obtained the MOVE magic from BOX_3F)
export const playerState = {
  gotMoveMagic: false,
};

export const allPuzzles = {
  elevator_1f: {
    title: "謎|1F",
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
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
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
  elevator_3f: {
    title: "謎|3F",
    unlocked: false,
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
    pieces: [
      {
        id: "3f_heart",
        image: "img/nazo/3f_heart.png",
        unlocked: false,
        answers: ["たかん"],
      },
      {
        id: "3f_diamond",
        image: "img/nazo/3f_diamond.png",
        unlocked: false,
        answers: ["いなか"],
      },
      {
        id: "3f_spade",
        image: "img/nazo/3f_spade.png",
        unlocked: false,
        answers: ["せぶん"],
      },
      {
        id: "3f_clover",
        image: "img/nazo/3f_clover.png",
        unlocked: false,
        answers: ["きんこ"],
      },
    ],
  },
  elevator_4f: {
    title: "謎|4F",
    unlocked: false,
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
    pieces: [
      {
        id: TILE.PUZZLE_4H,
        image: "img/nazo/4f_heart.png",
        unlocked: false,
        answers: ["ないん"],
      },
      {
        id: TILE.PUZZLE_4D,
        image: "img/nazo/4f_diamond.png",
        unlocked: false,
        answers: ["あきち"],
      },
      {
        id: TILE.PUZZLE_4S,
        image: "img/nazo/4f_spade.png",
        unlocked: false,
        answers: ["あうと"],
      },
      {
        id: TILE.PUZZLE_4C,
        image: "img/nazo/4f_clover.png",
        unlocked: false,
        answers: ["かめら"],
      },
    ],
  },

  // 5F puzzle set (unlocked by examining puzzle_5 tile) — follows 3F naming convention
  elevator_5f: {
    title: "謎|5F",
    unlocked: false,
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
    pieces: [
      {
        id: "5f_heart",
        image: "img/nazo/5f_heart.png",
        unlocked: false,
        answers: ["ぎんみ"],
      },
      {
        id: "5f_diamond",
        image: "img/nazo/5f_diamond.png",
        unlocked: false,
        answers: ["ぶたい"],
      },
      {
        id: "5f_spade",
        image: "img/nazo/5f_spade.png",
        unlocked: false,
        answers: ["しんぽ"],
      },
      {
        id: "5f_clover",
        image: "img/nazo/5f_clover.png",
        unlocked: false,
        answers: ["どかん"],
      },
    ],
  },

  // B1F puzzle set (unlocked by examining puzzle_b1 tile)
  elevator_b1: {
    title: "謎|B1F",
    unlocked: false,
    bottomImages: ["img/1f_answer.png", "img/elev_1_up.png"],
    pieces: [
      {
        id: "b1_heart",
        image: "img/nazo/b1_heart.png",
        unlocked: false,
        answers: ["あみめ"],
      },
      {
        id: "b1_diamond",
        image: "img/nazo/b1_diamond.png",
        unlocked: false,
        answers: ["さんか"],
      },
      {
        id: "b1_spade",
        image: "img/nazo/b1_spade.png",
        unlocked: false,
        answers: ["はちく"],
      },
      {
        id: "b1_clover",
        image: "img/nazo/b1_clover.png",
        unlocked: false,
        answers: ["かへん"],
      },
    ],
  },
};

// Explicit snake route definitions per-floor. When present, snakeManager will
// use these definitions instead of auto-detecting from map tiles for that floor.
export const SNAKE_DEFS = {
  0: [
    // B1F: outer counter-clockwise loop (starts at 8,6)
    {
      mode: "unclock",
      path: [
        { x: 8, y: 6 },
        { x: 9, y: 6 },
        { x: 10, y: 6 },
        { x: 10, y: 7 },
        { x: 10, y: 8 },
        { x: 10, y: 9 },
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 7, y: 9 },
        { x: 7, y: 8 },
        { x: 7, y: 7 },
        { x: 7, y: 6 },
      ],
      startIndex: 0,
    },
    // B1F: inner clockwise loop (snake A) starting at (10,7)
    {
      mode: "clock",
      path: [
        { x: 10, y: 7 },
        { x: 10, y: 8 },
        { x: 10, y: 9 },
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 8, y: 8 },
        { x: 8, y: 7 },
        { x: 9, y: 7 },
      ],
      startIndex: 0,
    },
    // B1F: inner clockwise loop (snake B) starting at (8,9)
    {
      mode: "clock",
      path: [
        { x: 10, y: 7 },
        { x: 10, y: 8 },
        { x: 10, y: 9 },
        { x: 9, y: 9 },
        { x: 8, y: 9 },
        { x: 8, y: 8 },
        { x: 8, y: 7 },
        { x: 9, y: 7 },
      ],
      // startIndex points to the element {x:8,y:9} which is at index 4 above
      startIndex: 4,
    },
  ],
};

// Statue metadata: display names and per-floor lists. Also indicate that
// the "statue_m" (マイク) instances on 6F and 2F move together.
export const STATUE_DISPLAY = {
  statue_m: "マイク",
  statue_f: "フランクリン",
  statue_nomove: "不動",
  statue_j: "ジェシー",
};

export const STATUE_BY_FLOOR = {
  6: ["statue_m"],
  5: ["statue_f", "statue_nomove"],
  3: ["statue_j"],
  2: ["statue_m"],
};

// statues that are linked and should move together (both floors will be
// updated when one is moved)
export const STATUE_SYNC = {
  statue_m: [2, 6],
};

export const START_POS_X = 4;
export const START_POS_Y = 0; // changed from 10 to 5 to start at y=5
export const START_FLOOR = 4; // start on 1F by default
