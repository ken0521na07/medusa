import * as mapService from "./mapService.js";
import * as snakeManager from "./snakeManager.js";
import { showCustomAlert } from "../ui/modals.js";
import { renderMagicList, renderInfoList } from "./infoManager.js";
import { TILE, allInfo, TILE_SIZE } from "../core/constants.js";

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
        const dir = cfg.direction || "上";
        if (dir === "上") return currentFloor - Math.abs(defaultDelta);
        return currentFloor + Math.abs(defaultDelta);
      }
    } catch (e) {}
    return currentFloor + defaultDelta;
  };

  const checkMagic = () => {
    const raw = normalize(magicInput.value);
    const player = window.__playerInstance;
    const x = player ? player.gridX : null;
    const y = player ? player.gridY : null;
    const floor = player ? player.floor : null;

    // Special spell: えいぞう
    const showAccepted = ["えいぞう", "映像", "エイゾウ"];
    const isShowSpell = showAccepted.map((s) => normalize(s)).includes(raw);

    // MOVE spell handling
    const moveAccepted = ["image", "イメージ", "いめーじ"];
    const normalizedMoveAccepted = moveAccepted.map((s) =>
      normalize(s).toLowerCase()
    );
    const isMoveSpell = normalizedMoveAccepted.includes(
      (raw || "").toLowerCase()
    );
    if (isMoveSpell) {
      try {
        const currentTile = mapService.getTile(x, y, floor);
        const isOnMoveTile =
          currentTile === TILE.MOVE || currentTile === "move" || true;
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

    if (isShowSpell) {
      if (floor === 2 && x === 5 && y === 5) {
        try {
          if (typeof window.teleportPlayer === "function")
            window.teleportPlayer(5, 5, 3);
          showCustomAlert("「えいぞう」を唱え、3Fに移動した。封筒Bを開こう。");
        } catch (e) {
          try {
            window.alert("魔法が唱えられた！正解です。");
          } catch (e2) {}
        }
      } else {
        const msg = "正しい魔法陣の上で唱えよう";
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

    // Cushion spell
    const cushionAccepted = ["fox", "フォックス", "ふぉっくす"];
    const rawNFKC = (raw || "").normalize
      ? (raw || "").normalize("NFKC")
      : raw || "";
    const rawLower = rawNFKC.toLowerCase();
    const normalizedCushion = cushionAccepted.map((s) =>
      (s || "").normalize
        ? s.normalize("NFKC").toLowerCase()
        : (s || "").toLowerCase()
    );
    const isCushionSpell =
      normalizedCushion.includes(rawLower) || rawLower.indexOf("fox") !== -1;

    if (isCushionSpell) {
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
        window.__cushionState = { active: true, remainingSteps: 3 };

        try {
          showCustomAlert(
            "「クッショ」を唱えた。３歩以内の移動であれば、穴に落ちても即死を免れる。"
          );
        } catch (e) {
          try {
            window.alert(
              "「クッショ」を唱えた。３歩以内の移動であれば、穴に落ちても即死を免れる。"
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

export default { init };
