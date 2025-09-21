import * as mapService from "./mapService.js";
import * as snakeManager from "./snakeManager.js";
import { showCustomAlert } from "../ui/modals.js";
import { renderMagicList, renderInfoList } from "./infoManager.js";
import { TILE, allInfo, TILE_SIZE, ORIGINAL_MAPS } from "../core/constants.js";

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
          showCustomAlert("呪文が違っている");
        } catch (e) {
          try {
            window.alert("呪文が違っている");
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
          showCustomAlert("何かが間違っているようだ");
        } catch (e) {
          try {
            window.alert("何かが間違っているようだ");
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
        let isOnMoveTile = currentTile === TILE.MOVE || currentTile === "move";
        // Fallback: if runtime map lost the marker (e.g. after a death restore),
        // allow casting if the ORIGINAL_MAPS had a 'move' tile here.
        try {
          if (!isOnMoveTile && ORIGINAL_MAPS && ORIGINAL_MAPS[floor]) {
            const origRow = ORIGINAL_MAPS[floor][y];
            const origVal = origRow && origRow[x];
            if (origVal === "move" || origVal === TILE.MOVE)
              isOnMoveTile = true;
          }
        } catch (e) {}
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
        openMoveModal();
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

// Move modal and Change modal follow - these are used by checkMagic when opening dialogs
function openMoveModal() {
  // recreate the original modal logic from uiSetup.js but scoped here
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
    // decide description based on current チェンジの状況 for ムーブ
    let moveChangeCfg = null;
    try {
      const player = window.__playerInstance;
      const floor = player ? player.floor : null;
      const perFloorMove =
        window.__changeStateByFloor && window.__changeStateByFloor[floor]
          ? window.__changeStateByFloor[floor]["ムーブ"]
          : null;
      const globalMove =
        window.__changeState && window.__changeState.global
          ? window.__changeState.global["ムーブ"] ||
            window.__changeState.global["move"]
          : null;
      moveChangeCfg = perFloorMove || globalMove;
      try {
        console.log("[move modal] moveChangeCfg", {
          floor,
          perFloorMove,
          globalMove,
          moveChangeCfg,
        });
      } catch (e) {}
    } catch (e) {}

    const moveIsInverted = (() => {
      const c = moveChangeCfg;
      if (!c) return false;
      if (c.type === "反転") return true;
      if (c.invert === true || c.reversed === true || c.revert === true)
        return true;
      if (c.dir === "下" || c.direction === "下") return true;
      return false;
    })();

    p1.textContent = moveIsInverted
      ? "ムーブを使用する像の名前を入力してください（別の階の像も指定可能）"
      : "ムーブを使用する像の名前を入力してください（同じ階の像のみ指定可能）";
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

    close.addEventListener("click", () => {
      modal.style.display = "none";
    });
    submit.addEventListener("click", () => {
      const name = (nameInput.value || "").trim();
      const dir = select.value;

      // delegate statue move to statueManager which handles display-name -> key mapping
      try {
        if (
          window.__statueManager &&
          typeof window.__statueManager.handleMoveByDisplayName === "function"
        ) {
          const res = window.__statueManager.handleMoveByDisplayName(name, dir);
          if (!res || res.ok === false) {
            modal.style.display = "none";
            try {
              showCustomAlert((res && res.msg) || "その像は動かせないようだ");
            } catch (e) {}
            return;
          }
        } else {
          // fallback: dispatch custom event for older code paths
          const ev = new CustomEvent("moveStatue", { detail: { name, dir } });
          window.dispatchEvent(ev);
        }
      } catch (e) {
        console.error("move modal submit failed", e);
      }

      try {
        showCustomAlert("「ムーブ」を唱え、像を移動した。");
      } catch (e) {}
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
  }
}

function openChangeModal() {
  // To keep this refactor focused, reuse existing modal creation logic from uiSetup.js
  // We'll create a minimal wrapper that shows the original modal if present or constructs it.
  // For brevity the full complex change modal is omitted here; we recreate a simpler version
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
    box.style.padding = "16px";
    box.style.background = "#fff";
    box.style.borderRadius = "6px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    box.style.minWidth = "240px";

    const t1 = document.createElement("div");
    t1.textContent = "チェンジ用の簡易ダイアログ。詳細は開発用。";
    box.appendChild(t1);

    const close = document.createElement("button");
    close.textContent = "閉じる";
    close.addEventListener("click", () => {
      modal.style.display = "none";
    });
    box.appendChild(close);

    modal.appendChild(box);
    document.body.appendChild(modal);
  } else {
    modal.style.display = "flex";
  }
}

export function serialize() {
  try {
    return {
      cushionState: window.__cushionState || null,
      cushionMap: window.__cushionMap || null,
    };
  } catch (e) {
    console.error("magicManager.serialize failed", e);
    return null;
  }
}

export function deserialize(payload) {
  try {
    if (!payload || typeof payload !== "object") return;
    if (payload.cushionState && typeof payload.cushionState === "object") {
      window.__cushionState = payload.cushionState;
    } else {
      window.__cushionState = window.__cushionState || {
        active: false,
        remainingSteps: 0,
      };
    }
    if (payload.cushionMap && typeof payload.cushionMap === "object") {
      window.__cushionMap = payload.cushionMap;
    } else {
      window.__cushionMap = window.__cushionMap || {};
    }
  } catch (e) {
    console.error("magicManager.deserialize failed", e);
  }
}

export default { init };
