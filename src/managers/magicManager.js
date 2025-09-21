import * as mapService from "./mapService.js";
import * as snakeManager from "./snakeManager.js";
import { showCustomAlert } from "../ui/modals.js";
import { renderMagicList, renderInfoList } from "./infoManager.js";
import { TILE, allInfo, TILE_SIZE } from "../core/constants.js";

// Ensure native alert calls route to the app's custom alert instead of using the blocking native alert.
try {
  if (typeof window !== "undefined" && typeof showCustomAlert === "function") {
    const _origAlert = window.alert;
    window.alert = function (msg) {
      try {
        showCustomAlert(String(msg));
      } catch (e) {
        // If custom alert fails for any reason, fall back to console logging but do NOT show native alert
        try {
          console.log("[alert->custom failed]", msg);
        } catch (e2) {}
      }
    };
    // keep a reference if needed elsewhere
    window.__orig_alert = _origAlert;
  }
} catch (e) {}

export function init() {
  try {
    _ensureMagicUI();
  } catch (e) {
    console.error("magicManager.init failed", e);
  }
}

function _ensureMagicUI() {
  const magicInput = document.getElementById("magic-input-text");
  const magicSubmit = document.getElementById("magic-input-submit");
  if (!magicInput || !magicSubmit) return;

  const normalize = (s) => (s || "").replace(/\s+/g, "").trim();

  // Helper: find a global change config by multiple possible keys (robust lookup)
  const findGlobalChange = (names = []) => {
    try {
      if (!window.__changeState || !window.__changeState.global)
        return { key: null, cfg: null };
      const g = window.__changeState.global;
      // try exact keys first
      for (const n of names) {
        if (Object.prototype.hasOwnProperty.call(g, n))
          return { key: n, cfg: g[n] };
      }
      // try case-insensitive / normalized match
      const lowerMap = {};
      for (const k of Object.keys(g)) lowerMap[(k || "").toLowerCase()] = k;
      for (const n of names) {
        const lk = (n || "").toLowerCase();
        if (lowerMap[lk]) return { key: lowerMap[lk], cfg: g[lowerMap[lk]] };
      }
      return { key: null, cfg: null };
    } catch (e) {
      return { key: null, cfg: null };
    }
  };

  const computeElevatorTarget = (currentFloor, defaultDelta = 1) => {
    try {
      if (!window.__changeState || !window.__changeState.elevatorPerFloor) {
        return currentFloor + defaultDelta;
      }
      const cfg = window.__changeState.elevatorPerFloor[currentFloor];
      if (!cfg) return currentFloor + defaultDelta;
      // New cfg shape: { inc: <number>, dir: '上'|'下' }
      if (
        typeof cfg.inc === "number" ||
        typeof cfg.amount === "number" ||
        typeof cfg.floors === "number"
      ) {
        // determine display floors
        let floors = 1;
        if (typeof cfg.floors === "number") floors = Number(cfg.floors);
        else if (typeof cfg.inc === "number") floors = 1 + Number(cfg.inc);
        else if (typeof cfg.amount === "number")
          floors = 1 + Number(cfg.amount);
        const dir = cfg.dir || cfg.direction || "上";
        return currentFloor + (dir === "上" ? floors : -floors);
      }
      // legacy inversion-only shape: treat as flip of default delta
      const dir =
        cfg.dir || cfg.direction || (cfg.type === "反転" ? "下" : "上");
      return currentFloor + (dir === "上" ? defaultDelta : -defaultDelta);
    } catch (e) {}
    return currentFloor + defaultDelta;
  };

  const checkMagic = () => {
    const raw = normalize(magicInput.value);
    const player = window.__playerInstance;
    const x = player ? player.gridX : null;
    const y = player ? player.gridY : null;
    const floor = player ? player.floor : null;

    // Special spell: えいぞう (and other elevator keywords)
    // Define per-floor elevator rules: keywords (hiragana & katakana), required change state, and destination
    const elevatorRules = {
      1: [
        {
          words: ["ぱいきじ", "パイキジ"],
          require: { none: true },
          dest: { x: 5, y: 5, f: 2 },
        },
      ],
      2: [
        {
          words: ["えいぞう", "エイゾウ"],
          require: { none: true },
          dest: { x: 5, y: 5, f: 3 },
        },
      ],
      3: [
        {
          words: ["たいせき", "タイセキ"],
          require: { none: true },
          dest: { x: 5, y: 5, f: 4 },
        },
        {
          words: ["かなぶん", "カナブン"],
          require: { increase: 1 },
          dest: { x: 5, y: 5, f: 5 },
        },
        {
          words: ["こんかん", "コンカン"],
          require: { increase: 2, invert: true },
          dest: { x: 5, y: 5, f: 0 },
        },
      ],
      4: [
        {
          words: ["いきうめ", "イキウメ"],
          require: { increase: 1 },
          dest: { x: 5, y: 5, f: 6 },
        },
      ],
      5: [
        {
          words: ["かんたん", "カンタン"],
          require: { increase: 1, invert: true },
          dest: { x: 5, y: 5, f: 3 },
        },
      ],
      0: [
        {
          words: ["あさはか", "アサハカ"],
          require: { none: true },
          dest: { x: 5, y: 5, f: 1 },
        },
      ],
    };

    // helper: normalize string for comparison
    const norm = (s) => (s || "").replace(/\s+/g, "").toLowerCase();

    // find matching rules anywhere
    const rawNorm = norm(raw);
    const matchesAnywhere = [];
    for (const [floorStr, arr] of Object.entries(elevatorRules)) {
      for (const entry of arr) {
        for (const w of entry.words) {
          if (norm(w) === rawNorm) {
            matchesAnywhere.push({ floor: Number(floorStr), entry });
            break;
          }
        }
      }
    }

    // log current overall changeState for debugging when magic modal is invoked
    try {
      console.log("[magic] current changeState", {
        changeState: window.__changeState,
        changeStateByFloor: window.__changeStateByFloor,
      });
    } catch (e) {}

    const currentTile = mapService.getTile(x, y, floor);
    const isOnElev = currentTile === "elev" || currentTile === "ELEV";

    if (!isOnElev) {
      // Not on an elev tile. If the typed word would be correct elsewhere, tell player to stand on correct circle.
      if (matchesAnywhere.length > 0) {
        try {
          showCustomAlert("正しい魔法陣の上で唱えよう");
        } catch (e) {
          try {
            window.alert("正しい魔法陣の上で唱えよう");
          } catch (e2) {}
        }
        return;
      }
    } else {
      // On elev tile: check rules for this floor specifically
      const rulesForFloor = elevatorRules[floor] || [];
      // find an entry whose words match
      const candidate = rulesForFloor.find((entry) =>
        entry.words.some((w) => norm(w) === rawNorm)
      );

      // validate change state requirements for this floor
      const req = candidate ? candidate.require || {} : {};
      const cfg =
        window.__changeState && window.__changeState.elevatorPerFloor
          ? window.__changeState.elevatorPerFloor[floor]
          : null;

      const checkIncrease = (need) => {
        if (typeof need === "undefined") return true;
        if (!cfg) return false;
        // derive inc from cfg (cfg.inc or cfg.floors - base)
        if (typeof cfg.inc === "number") return cfg.inc === need;
        if (typeof cfg.floors === "number") return cfg.floors - 1 === need;
        return false;
      };
      const checkInvert = (need) => {
        if (!need) return true;
        if (!cfg) return false;
        // new shape: dir === '下' indicates inversion
        if (cfg.dir === "下" || cfg.direction === "下") return true;
        // legacy flags
        if (cfg.reversed === true || cfg.invert === true || cfg.revert === true)
          return true;
        if (cfg.type === "反転") return true;
        return false;
      };

      const checkNone = () => {
        // require that there is no meaningful cfg set for this floor
        return !cfg || Object.keys(cfg).length === 0;
      };

      // If there's no word-matching candidate, check whether any entry on this floor
      // WOULD be satisfied by the current チェンジの状況 (cfg). If so, the only
      // mismatch is the typed keyword -> show "呪文が違うようだ".
      if (!candidate) {
        const stateMatching = rulesForFloor.some((entry) => {
          const r = entry.require || {};
          let ok = true;
          if (r.none) ok = ok && checkNone();
          if (typeof r.increase !== "undefined")
            ok = ok && checkIncrease(r.increase);
          if (r.invert) ok = ok && checkInvert(true);
          return ok;
        });

        if (stateMatching) {
          try {
            showCustomAlert("呪文が違うようだ");
          } catch (e) {
            try {
              window.alert("呪文が違うようだ");
            } catch (e2) {}
          }
          return;
        }

        // No entry on this floor matches the current change state either.
        // Fall back to generic wrong-spell message.
        try {
          showCustomAlert("呪文が違うようだ");
        } catch (e) {
          try {
            window.alert("呪文が違うようだ");
          } catch (e2) {}
        }
        return;
      }

      // At this point we have a word-matching candidate. Validate its required change state.
      const req2 = candidate.require || {};

      let ok = true;
      if (req2.none) ok = checkNone();
      if (typeof req2.increase !== "undefined")
        ok = ok && checkIncrease(req2.increase);
      if (req2.invert) ok = ok && checkInvert(true);

      if (!ok) {
        // Word was correct for this floor but チェンジの状況 doesn't match.
        try {
          showCustomAlert("チェンジの状況が違うようだ");
        } catch (e) {
          try {
            window.alert("チェンジの状況が違うようだ");
          } catch (e2) {}
        }
        return;
      }

      // Passed all checks: perform teleport
      try {
        if (typeof window.teleportPlayer === "function") {
          window.teleportPlayer(
            candidate.dest.x,
            candidate.dest.y,
            candidate.dest.f
          );
        } else if (player && typeof player.teleport === "function") {
          player.teleport(candidate.dest.x, candidate.dest.y, candidate.dest.f);
        }
        showCustomAlert("魔法が唱えられた！移動した。");
      } catch (e) {
        try {
          window.alert("魔法が唱えられた！正解です。");
        } catch (e2) {}
      }
      return;
    }

    // MOVE spell handling
    // Determine current チェンジの状況 for ムーブ (prefer per-floor)
    const moveLookup = findGlobalChange([
      "ムーブ",
      "ムーヴ",
      "Move",
      "move",
      "ムーブ(ム)",
    ]);
    // check per-floor override first
    const perFloorMove =
      window.__changeStateByFloor && window.__changeStateByFloor[floor]
        ? window.__changeStateByFloor[floor]["ムーブ"]
        : null;
    const moveChangeCfg = perFloorMove || moveLookup.cfg;
    try {
      console.log("[magic] move lookup", {
        changeState: window.__changeState,
        foundKey: moveLookup.key,
        cfg: moveChangeCfg,
      });
    } catch (e) {}
    const moveIsInverted = (() => {
      const c = moveChangeCfg;
      if (!c) return false;
      // Prefer explicit opt field when available (newer saved format)
      if (typeof c.opt !== "undefined" && c.opt !== null) {
        return String(c.opt) === "違う";
      }
      if (c.type === "反転") return true;
      if (c.invert === true || c.reversed === true || c.revert === true)
        return true;
      if (c.dir === "下" || c.direction === "下") return true;
      return false;
    })();

    const moveWordsNormal = ["image", "イメージ", "いめーじ"].map((s) =>
      (s || "").toLowerCase()
    );
    const moveWordsInverted = ["えぐじっと", "エグジット", "exit"].map((s) =>
      (s || "").toLowerCase()
    );

    const acceptedMoveWords = moveIsInverted
      ? moveWordsInverted
      : moveWordsNormal;
    const alternateMoveWords = moveIsInverted
      ? moveWordsNormal
      : moveWordsInverted;

    const rawLowerMove = (raw || "").toLowerCase();
    const isMoveSpell = acceptedMoveWords.includes(rawLowerMove);
    const isMoveSpellAlternate = alternateMoveWords.includes(rawLowerMove);

    if (isMoveSpell || isMoveSpellAlternate) {
      try {
        const currentTile = mapService.getTile(x, y, floor);
        const isOnMoveTile =
          currentTile === TILE.MOVE || currentTile === "move";
        if (!isOnMoveTile) {
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
        if (!(allInfo && allInfo.box_3f && allInfo.box_3f.unlocked)) {
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
        // If the word matches the alternate words but the チェンジの状況 is not set for that
        // word, show a "wrong spell" message (keyword mismatch under otherwise-correct conditions).
        if (isMoveSpellAlternate && !isMoveSpell) {
          try {
            showCustomAlert("呪文が違うようだ");
          } catch (e) {
            try {
              window.alert("呪文が違うようだ");
            } catch (e2) {}
          }
          return;
        }

        // Word is accepted for current チェンジの状況: log internal state and open modal
        try {
          console.log("[magic] MOVE invoked", {
            moveChangeCfg: moveChangeCfg,
            moveIsInverted: moveIsInverted,
            acceptedMoveWords: acceptedMoveWords,
            alternateMoveWords: alternateMoveWords,
            rawTyped: raw,
          });
        } catch (e) {}
        try {
          if (
            typeof window !== "undefined" &&
            typeof window.openMoveModal === "function"
          ) {
            window.openMoveModal();
          } else if (typeof openMoveModal === "function") {
            openMoveModal();
          } else {
            console.warn("openMoveModal is not available");
          }
        } catch (e) {}
        return;
      } catch (e) {
        console.error("isMoveSpell handler failed:", e);
        const msg = "呪文が間違っているようだ";
        try {
          showCustomAlert(msg);
        } catch (e2) {
          try {
            window.alert(msg);
          } catch (e3) {}
        }
        return;
      }
    }

    // Cushion spell
    const rawNFKC = (raw || "").normalize
      ? (raw || "").normalize("NFKC")
      : raw || "";
    const rawLower = rawNFKC.toLowerCase();

    // Determine if クッショ has been changed via チェンジ and compute effective steps
    let effectiveCushionSteps = 3; // default
    let cushionChangeCfg = null;
    try {
      cushionChangeCfg =
        window.__changeState &&
        window.__changeState.global &&
        window.__changeState.global["クッショ"];
      if (
        cushionChangeCfg &&
        cushionChangeCfg.type === "増加" &&
        typeof cushionChangeCfg.amount !== "undefined"
      ) {
        const add = Number(cushionChangeCfg.amount) || 0;
        effectiveCushionSteps = Math.max(1, 3 + add);
      }
    } catch (e) {}

    const cushionNormalWords = ["fox", "フォックス", "ふぉっくす"].map((s) =>
      (s || "").normalize
        ? s.normalize("NFKC").toLowerCase()
        : (s || "").toLowerCase()
    );
    const cushionIncreasedWords = ["fan", "ふぁん", "ファン"].map((s) =>
      (s || "").normalize
        ? s.normalize("NFKC").toLowerCase()
        : (s || "").toLowerCase()
    );

    const cushionIsIncreased = effectiveCushionSteps === 4;
    const acceptedCushionWords = cushionIsIncreased
      ? cushionIncreasedWords
      : cushionNormalWords;
    const alternateCushionWords = cushionIsIncreased
      ? cushionNormalWords
      : cushionIncreasedWords;

    const isCushionSpell = acceptedCushionWords.includes(rawLower);
    const isCushionSpellAlternate = alternateCushionWords.includes(rawLower);

    if (isCushionSpell || isCushionSpellAlternate) {
      try {
        const currentTile = mapService.getTile(x, y, floor);
        const isOnCushion =
          currentTile === TILE.CUSHON || currentTile === "cushion";
        if (!isOnCushion) {
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
        // If the typed keyword matches the alternate word list but the current チェンジの状況
        // does not permit that keyword, tell the player the spell (keyword) is wrong.
        if (isCushionSpellAlternate && !isCushionSpell) {
          try {
            showCustomAlert("呪文が違うようだ");
          } catch (e) {
            try {
              window.alert("呪文が違うようだ");
            } catch (e2) {}
          }
          return;
        }

        window.__cushionMap = window.__cushionMap || {};
        const mapping = {
          "1,0,6": { x: 0, y: 9, f: 5 },
          "9,0,6": { x: 0, y: 1, f: 5 },
          "5,1,5": { x: 9, y: 5, f: 3 },
          "10,4,5": { x: 4, y: 10, f: 4 },
          "7,0,4": { x: 7, y: 0, f: 3 },
          "6,10,4": { x: 6, y: 10, f: 3 },
          "9,5,4": { x: 9, y: 5, f: 3 },
          "3,2,2": { x: 8, y: 3, f: 0 },
        };
        window.__cushionMap = Object.assign({}, window.__cushionMap, mapping);
        // set remainingSteps based on effectiveCushionSteps computed earlier
        window.__cushionState = {
          active: true,
          remainingSteps: effectiveCushionSteps,
        };

        try {
          showCustomAlert(
            `「クッショ」を唱えた。${effectiveCushionSteps}歩以内の移動であれば、穴に落ちても即死を免れる。`
          );
        } catch (e) {
          try {
            window.alert(
              `「クッショ」を唱えた。${effectiveCushionSteps}歩以内の移動であれば、穴に落ちても即死を免れる。`
            );
          } catch (e2) {}
        }
      } catch (e) {
        console.error("cushion spell failed", e);
      }
      return;
    }

    // unknown/other spells: show default
    try {
      showCustomAlert("呪文が間違っているようだ");
    } catch (e) {
      try {
        window.alert("呪文が間違っているようだ");
      } catch (e2) {}
    }
  };

  magicSubmit.addEventListener("click", checkMagic);
  magicInput.addEventListener("keydown", (e) => {
    try {
      const _isComposing = e.isComposing || false;
      let _ignoreNextEnter = false;
      if (e.key === "Enter") {
        if (_isComposing || _ignoreNextEnter || e.isComposing) return;
        checkMagic();
      }
    } catch (err) {}
  });

  magicSubmit.addEventListener("click", () => {
    try {
      magicInput.value = "";
    } catch (e) {}
  });
}

// Minimal persistence helpers used elsewhere. Keep these robust and side-effect free.
export function serialize() {
  try {
    return window.__magicState || {};
  } catch (e) {
    return {};
  }
}

export function deserialize(obj) {
  try {
    window.__magicState = obj || {};
  } catch (e) {}
}
