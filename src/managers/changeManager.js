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

    // show/hide fields based on target and effect
    function updateFieldVisibility() {
      const target = select1.value;
      const effect = select2.value;
      if (target === "エレベ") {
        // Don't show explicit 上/下 selection in チェンジ modal for エレベ
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        if (effect === "数字増加") {
          t3.style.display = "block";
          select3.style.display = "block";
        } else {
          t3.style.display = "none";
          select3.style.display = "none";
        }
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      } else if (target === "ムーブ") {
        // ムーブでは意味反転を切り替えるため、現在のフロア状態に応じて
        // 同じ/違う を表示・選択できるようにする。
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        t3.style.display = "none";
        select3.style.display = "none";

        // ムーブの同じ/違う選択はモーダルでユーザーが直接選ぶものではない。
        // 意味反転は「意味反転」効果を適用した際に既存の状態を反転する仕様のため
        // モーダル側では選択肢を表示しない。
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      } else if (target === "クッショ") {
        // Cushion only supports 数字増加 (and we accept +1 only)
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
        if (effect === "数字増加") {
          t3.style.display = "block";
          select3.style.display = "block";
          // restrict options visually to 1 (we keep full select but validation enforces 1)
        } else {
          t3.style.display = "none";
          select3.style.display = "none";
        }
      } else {
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        t3.style.display = "none";
        select3.style.display = "none";
        moveLabel.style.display = "none";
        moveSelect.style.display = "none";
      }
    }

    select1.addEventListener("change", updateFieldVisibility);
    select2.addEventListener("change", updateFieldVisibility);

    // initialize visibility/state based on current player floor and change state
    try {
      const player = window.__playerInstance;
      const floor = player ? player.floor : null;
      console.log("[change] opening change modal", {
        floor: floor,
        changeState: window.__changeState,
        changeStateByFloor: window.__changeStateByFloor,
      });
    } catch (e) {}
    // apply initial field visibility so the modal reflects current state
    try {
      updateFieldVisibility();
    } catch (e) {}

    close.addEventListener("click", () => {
      modal.style.display = "none";
    });

    submit.addEventListener("click", () => {
      const target = select1.value;
      const effect = select2.value;
      const amount = select3.value;
      const direction = dirSelect.value;
      const moveOpt = moveSelect.value;

      const player = window.__playerInstance;
      const floor = player ? player.floor : null;

      // Ensure runtime change state objects exist to avoid indexing undefined
      window.__changeState = window.__changeState || {};
      window.__changeState.elevatorPerFloor =
        window.__changeState.elevatorPerFloor || {};
      window.__changeState.global = window.__changeState.global || {};
      window.__changeStateByFloor = window.__changeStateByFloor || {};

      // validation helper
      const invalid = () => {
        try {
          const keywordModal = document.getElementById("keyword-modal");
          if (keywordModal) keywordModal.style.display = "none";
        } catch (e) {}
        try {
          // also close the change modal we're currently showing
          if (modal) modal.style.display = "none";
        } catch (e) {}
        try {
          showCustomAlert("今はそれをする必要はない");
        } catch (e) {
          try {
            showCustomAlert("今はそれをする必要はない");
          } catch (e2) {}
        }
      };

      // Per-floor allowed configuration (only these inputs are accepted)
      const perFloorConfig = {
        3: {
          エレベ: { 意味反転: true, 数字増加: [1, 2] },
          ムーブ: { 意味反転: true },
        },
        4: {
          エレベ: { 数字増加: [1] },
          クッショ: { 数字増加: [1] },
        },
        5: {
          // allow +1 on 5F to match elevator rules
          エレベ: { 意味反転: true, 数字増加: [1] },
        },
      };

      const floorCfg = perFloorConfig[floor] || null;
      const targetCfg = floorCfg ? floorCfg[target] : null;

      // If nothing is configured for this floor/target, reject
      if (!targetCfg) {
        invalid();
        return;
      }

      // Validate effect for the selected target according to the config
      if (effect === "数字増加") {
        const num = Number(amount || 1);
        const allowedNums = targetCfg["数字増加"];
        if (!Array.isArray(allowedNums) || !allowedNums.includes(num)) {
          invalid();
          return;
        }
      } else if (effect === "意味反転") {
        if (!targetCfg["意味反転"]) {
          invalid();
          return;
        }
      } else {
        invalid();
        return;
      }

      // Apply based on target (existing behavior preserved, but only reached when validated above)
      if (target === "エレベ") {
        if (!floor) {
          invalid();
          return;
        }

        if (effect === "数字増加") {
          const num = Number(amount || 1);
          // base elevator movement is 1 (表示上は '1つ上')
          const base = 1;
          // existing entry for this floor
          const existing = window.__changeState.elevatorPerFloor[floor] || null;
          // determine previous cumulative increment (inc). Preserve invert flag if present.
          let prevInc = 0;
          let wasInverted = false;
          if (existing) {
            if (typeof existing.inc === "number") prevInc = existing.inc;
            else if (typeof existing.floors === "number")
              prevInc = Math.max(0, existing.floors - base);
            // determine inversion from dir or legacy flags
            if (existing.dir) {
              wasInverted = existing.dir === "下";
            } else if (typeof existing.invert !== "undefined") {
              wasInverted = !!existing.invert;
            } else if (existing.type === "反転") {
              wasInverted = true;
            }
          }

          const newInc = prevInc + num;
          // allowed cumulative increments for this floor
          const allowedIncs = targetCfg["数字増加"]; // e.g. [1,2]
          if (!Array.isArray(allowedIncs) || !allowedIncs.includes(newInc)) {
            // close keyword modal (magic modal) then show invalid alert
            try {
              const keywordModal = document.getElementById("keyword-modal");
              if (keywordModal) keywordModal.style.display = "none";
            } catch (e) {}
            invalid();
            return;
          }

          // persist per-floor: store numeric increment and direction separately so
          // 意味反転 and 数字増加 can be combined. Keep 'type' for backward compat.
          // Determine current direction: prefer existing.dir/existing.direction, otherwise default '上'.
          let currentDir = "上";
          if (existing) {
            currentDir =
              existing.dir ||
              existing.direction ||
              (existing.type === "反転" ? "下" : "上");
          }
          const newCfg = {
            inc: newInc,
            dir: currentDir,
          };
          window.__changeState.elevatorPerFloor[floor] = newCfg;
          try {
            console.log(
              `[change] elevator floor ${floor} applied numeric increase -> inc=${newCfg.inc}, dir=${newCfg.dir}`,
              newCfg
            );
          } catch (e) {}
        } else if (effect === "意味反転") {
          // Toggle meaning inversion per-floor but preserve any numeric increments
          const existing = window.__changeState.elevatorPerFloor[floor];
          if (existing) {
            // If numeric increment exists, flip dir
            if (typeof existing.inc === "number") {
              existing.dir = existing.dir === "上" ? "下" : "上";
              window.__changeState.elevatorPerFloor[floor] = existing;
              try {
                console.log(
                  `[change] elevator floor ${floor} toggled invert -> inc=${existing.inc}, dir=${existing.dir}`,
                  existing
                );
              } catch (e) {}
            } else if (existing.type === "増加") {
              // legacy shape: had 増加 but without inc field
              const prevInc =
                typeof existing.inc === "number"
                  ? existing.inc
                  : typeof existing.floors === "number"
                  ? Math.max(0, existing.floors - 1)
                  : 0;
              const dir = existing.direction || existing.dir || "上";
              window.__changeState.elevatorPerFloor[floor] = {
                inc: prevInc,
                dir: dir === "上" ? "下" : "上",
              };
              try {
                const cfg = window.__changeState.elevatorPerFloor[floor];
                console.log(
                  `[change] elevator floor ${floor} legacy increase+invert -> inc=${cfg.inc}, dir=${cfg.dir}`,
                  cfg
                );
              } catch (e) {}
            } else if (existing.type === "反転") {
              // remove pure inversion
              try {
                delete window.__changeState.elevatorPerFloor[floor];
                try {
                  console.log(
                    `[change] elevator floor ${floor} removed pure inversion (no config)`
                  );
                } catch (e) {}
              } catch (e) {}
            } else {
              // set pure inversion as dir='下' (flip default up)
              window.__changeState.elevatorPerFloor[floor] = {
                inc: 0,
                dir: "下",
              };
              try {
                const cfg = window.__changeState.elevatorPerFloor[floor];
                console.log(
                  `[change] elevator floor ${floor} set pure inversion fallback -> inc=${cfg.inc}, dir=${cfg.dir}`,
                  cfg
                );
              } catch (e) {}
            }
          } else {
            // no existing config -> set as inverted relative to default
            window.__changeState.elevatorPerFloor[floor] = {
              inc: 0,
              dir: "下",
            };
            try {
              const cfg = window.__changeState.elevatorPerFloor[floor];
              console.log(
                `[change] elevator floor ${floor} set inversion (new) -> inc=${cfg.inc}, dir=${cfg.dir}`,
                cfg
              );
            } catch (e) {}
          }
        } else {
          invalid();
          return;
        }

        // Note: UI rendering (when opening the magic modal) will apply per-floor
        // presentation using window.__changeState; do NOT mutate allInfo here so
        // that changes remain strictly per-floor and are applied only when the
        // player opens the magic modal on the relevant floor.
      } else if (target === "ムーブ") {
        // For ムーブ, only '意味反転' is applicable.
        if (effect !== "意味反転") {
          invalid();
          return;
        }
        // 意味反転は現在の状態を反転する効果であり、モーダルで "同じ/違う" を
        // ユーザーが直接指定するものではありません。ここでは per-floor 優先で
        // 既存設定を読み、同じなら違うに・違うなら同じに反転させます。
        try {
          window.__changeState.global = window.__changeState.global || {};
          window.__changeStateByFloor = window.__changeStateByFloor || {};
          window.__changeStateByFloor[floor] =
            window.__changeStateByFloor[floor] || {};

          // find existing config (per-floor preferred)
          const existing =
            window.__changeStateByFloor[floor] &&
            window.__changeStateByFloor[floor]["ムーブ"]
              ? window.__changeStateByFloor[floor]["ムーブ"]
              : (window.__changeState.global &&
                  (window.__changeState.global["ムーブ"] ||
                    window.__changeState.global["move"])) ||
                null;

          let currentOpt = "同じ";
          if (existing) {
            if (existing.opt) currentOpt = existing.opt;
            else {
              // derive from legacy flags
              const c = existing;
              const inverted =
                c.type === "反転" ||
                c.invert === true ||
                c.reversed === true ||
                c.revert === true ||
                c.dir === "下" ||
                c.direction === "下";
              currentOpt = inverted ? "違う" : "同じ";
            }
          }

          const flipped = currentOpt === "同じ" ? "違う" : "同じ";

          // persist flip both per-floor and globally (global kept for backward compat)
          window.__changeState.global.move = { type: "反転", opt: flipped };
          window.__changeStateByFloor[floor]["ムーブ"] = {
            type: "反転",
            opt: flipped,
          };

          try {
            console.log("[change] per-floor move toggled", {
              floor: floor,
              from: currentOpt,
              to: flipped,
              cfg: window.__changeStateByFloor[floor]["ムーブ"],
            });
          } catch (e) {}
        } catch (e) {}
      } else if (target === "クッショ") {
        // Special-case: クッショ supports only numeric +1 globally
        if (effect !== "数字増加") {
          invalid();
          return;
        }
        const num = Number(amount || 1);
        // only accept +1 as valid change
        if (num !== 1) {
          invalid();
          return;
        }
        // persist globally; accumulate if already present
        window.__changeState.global["クッショ"] = window.__changeState.global[
          "クッショ"
        ] || { type: "増加", amount: 0 };
        window.__changeState.global["クッショ"].amount += num;
      } else {
        // For other spells, accept numeric/meaning changes and save globally
        if (effect === "数字増加") {
          window.__changeState.global[target] = {
            type: "増加",
            amount: Number(amount || 1),
          };
        } else if (effect === "意味反転") {
          window.__changeState.global[target] = { type: "反転" };
        } else {
          invalid();
          return;
        }
        // do not mutate allInfo here; UI will apply per-floor/global presentation when needed
      }

      // refresh magic list UI if open
      try {
        const list = document.getElementById("magic-list");
        if (list && typeof renderMagicList === "function")
          renderMagicList(list);
        // if magic detail page is open and currently showing the affected magic, refresh it
        try {
          const magicPage2 = document.getElementById("magic-page-2");
          const magicTitle = document.getElementById("magic-detail-title");
          const contentEl = document.getElementById("magic-detail-content");
          if (
            magicPage2 &&
            magicPage2.style.display !== "none" &&
            magicTitle &&
            contentEl
          ) {
            // map target labels to info keys
            const map = {
              エレベ: "box_1f",
              ムーブ: "box_3f",
              クッショ: "box_cushion",
              チェンジ: "box_change",
            };
            const key = map[target];
            if (
              key &&
              allInfo[key] &&
              magicTitle.textContent === allInfo[key].title
            ) {
              // call showInfoDetail to re-render content
              try {
                showInfoDetail(key, magicTitle, contentEl);
              } catch (e) {}
            }
          }
        } catch (e) {}
      } catch (e) {}

      // Close magic modal (keyword modal) if open, then notify the player
      try {
        const keywordModal = document.getElementById("keyword-modal");
        if (keywordModal) keywordModal.style.display = "none";
      } catch (e) {}

      // ensure modal is closed before showing alert
      setTimeout(() => {
        try {
          showCustomAlert("チェンジを適用しました");
        } catch (e) {
          try {
            showCustomAlert("チェンジを適用しました");
          } catch (e2) {}
        }
      }, 10);
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
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
