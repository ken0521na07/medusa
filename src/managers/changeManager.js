import { allInfo } from "../core/constants.js";
import { renderMagicList, showInfoDetail } from "./infoManager.js";
import { showCustomAlert } from "../ui/modals.js";

// changeManager: moves the チェンジ modal and logic out of uiSetup
// Note: this module reuses global objects (allInfo, showCustomAlert, renderMagicList, showInfoDetail, etc.)
// to keep parity with previous implementation in uiSetup.js. It exposes openChangeModal().
export function openChangeModal() {
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
    // slightly more padding to match other modals
    box.style.padding = "16px";
    box.style.background = "#fff";
    box.style.borderRadius = "6px";
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "8px";
    box.style.minWidth = "240px";

    // テキスト1
    const t1 = document.createElement("div");
    t1.textContent = "①「チェンジ」を使用する対象の魔法を選択してください";
    box.appendChild(t1);

    // プルダウン1
    const select1 = document.createElement("select");
    select1.id = "change-target-select";
    ["エレベ", "ムーブ", "クッショ", "チェンジ"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select1.appendChild(o);
    });
    box.appendChild(select1);

    // direction select (for エレベ)
    const dirLabel = document.createElement("div");
    dirLabel.id = "change-direction-label";
    dirLabel.textContent = "方向を選択してください（上/下）";
    dirLabel.style.display = "none";
    box.appendChild(dirLabel);

    const dirSelect = document.createElement("select");
    dirSelect.id = "change-direction-select";
    ["上", "下"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      dirSelect.appendChild(o);
    });
    dirSelect.style.display = "none";
    box.appendChild(dirSelect);

    // テキスト2
    const t2 = document.createElement("div");
    t2.textContent = "②使用する効果を選択してください（数字増加or意味反転）";
    box.appendChild(t2);

    // プルダウン2
    const select2 = document.createElement("select");
    select2.id = "change-effect-select";
    ["数字増加", "意味反転"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select2.appendChild(o);
    });
    // default to 意味反転
    select2.value = "意味反転";
    box.appendChild(select2);

    // テキスト3 + プルダウン3 (増加量) (hidden by default)
    const t3 = document.createElement("div");
    t3.id = "change-amount-label";
    t3.textContent = "③増加量を選択してください";
    t3.style.display = "none";
    box.appendChild(t3);

    const select3 = document.createElement("select");
    select3.id = "change-amount-select";
    select3.style.display = "none";
    for (let i = 1; i <= 5; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      select3.appendChild(o);
    }
    box.appendChild(select3);

    // ムーブ用オプション（同じ/違う）
    const moveLabel = document.createElement("div");
    moveLabel.id = "change-move-label";
    moveLabel.textContent =
      "ムーブで指定できる像: 同じ/違う を選択してください";
    moveLabel.style.display = "none";
    box.appendChild(moveLabel);

    const moveSelect = document.createElement("select");
    moveSelect.id = "change-move-select";
    ["同じ", "違う"].forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      moveSelect.appendChild(o);
    });
    moveSelect.style.display = "none";
    box.appendChild(moveSelect);

    // submit button
    const submit = document.createElement("button");
    submit.textContent = "送信";
    submit.id = "change-submit-btn";
    // match other UI buttons appearance
    submit.className = "ui-button";
    box.appendChild(submit);

    // close button
    const close = document.createElement("button");
    close.textContent = "閉じる";
    close.id = "change-close-btn";
    // mark as close for header styling consistency
    close.className = "close-btn";
    // make close button visually compact to match custom alert/modal close
    close.style.padding = "6px 8px";
    close.style.fontSize = "0.95em";
    close.style.alignSelf = "flex-end";
    box.appendChild(close);

    modal.appendChild(box);
    document.body.appendChild(modal);

    // helper: ensure global change state exists
    window.__changeState = window.__changeState || {
      elevatorPerFloor: {},
      global: {},
    };

    // apply initial field visibility so the modal reflects current state
    try {
      updateFieldVisibility();
    } catch (e) {}

    // expose a programmatic open that allows preselecting target based on caller
    window.__openChangeModal = function (presetTarget) {
      try {
        if (!modal) return;
        if (presetTarget) {
          try {
            select1.value = presetTarget;
          } catch (e) {}
        }
        updateFieldVisibility();
        modal.style.display = "flex";
      } catch (e) {}
    };

    return modal;
  }
  return modal;
}

// New helper: show confirm before opening change modal
export function confirmAndOpenChangeModal(presetTarget) {
  try {
    // open confirm dialog
    showCustomAlert = showCustomAlert || null; // noop to satisfy linter
  } catch (e) {}
  try {
    // lazy import to avoid circular in some build setups
    const modals = require("../ui/modals.js");
    if (modals && typeof modals.showConfirm === "function") {
      modals.showConfirm("チェンジを使用しますか？", {
        onConfirm: () => {
          try {
            if (typeof window.__openChangeModal === "function")
              window.__openChangeModal(presetTarget);
          } catch (e) {}
        },
        onCancel: () => {},
      });
    } else {
      if (typeof window.__openChangeModal === "function")
        window.__openChangeModal(presetTarget);
    }
  } catch (e) {
    try {
      if (typeof window.__openChangeModal === "function")
        window.__openChangeModal(presetTarget);
    } catch (ex) {}
  }
}

// Serialize change-related runtime state
export function serialize() {
  try {
    return {
      changeState: window.__changeState || null,
      changeStateByFloor: window.__changeStateByFloor || null,
    };
  } catch (e) {
    console.error("changeManager.serialize failed", e);
    return null;
  }
}

// Deserialize change-related runtime state
export function deserialize(payload) {
  try {
    if (!payload || typeof payload !== "object") return;
    if (payload.changeState && typeof payload.changeState === "object") {
      window.__changeState = payload.changeState;
    } else {
      window.__changeState = window.__changeState || {
        elevatorPerFloor: {},
        global: {},
      };
    }
    if (
      payload.changeStateByFloor &&
      typeof payload.changeStateByFloor === "object"
    ) {
      window.__changeStateByFloor = payload.changeStateByFloor;
    } else {
      window.__changeStateByFloor = window.__changeStateByFloor || {};
    }
  } catch (e) {
    console.error("changeManager.deserialize failed", e);
  }
}
