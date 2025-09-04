// ...existing code...
export const TILE_SIZE = 40;
export const MAP_WIDTH = 11;
export const MAP_HEIGHT = 11;

export const TILE = {
  FLOOR: 0,
  WALL: 1,
  INFO_MSG: 2,
  INFO_HOLE: "info_hole",
  HOLE: "hole",
  BOX_1F: "box_1f",
  PUZZLE_1H: "puzzle_1h",
  PUZZLE_1S: "puzzle_1s",
  PUZZLE_1C: "puzzle_1c",
  PUZZLE_1D: "puzzle_1d",
};

export const mapData = [
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

export const ORIGINAL_MAP = mapData.map((row) => row.slice());

export const allInfo = {
  about_hole: {
    title: "穴について",
    content:
      "穴に落ちると真下に落ちて死んでしまう。（死亡した場合、直近でそのフロアに到達した位置に戻される）落ちないように注意しよう。",
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
};

export const START_POS_X = 5;
export const START_POS_Y = 10;
