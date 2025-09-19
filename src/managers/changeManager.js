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
        // Move only needs effect selection; no extra fields shown here
        dirLabel.style.display = "none";
        dirSelect.style.display = "none";
        t3.style.display = "none";
        select3.style.display = "none";
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

      // validation helper
      const invalid = () => {
        try {
          showCustomAlert("今はそれをする必要はない");
        } catch (e) {
          try {
            window.alert("今はそれをする必要はない");
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
          エレベ: { 数字増加: [2] },
          クッショ: { 数字増加: [1] },
        },
        5: {
          エレベ: { 意味反転: true, 数字増加: [2] },
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
          // persist per-floor
          window.__changeState.elevatorPerFloor[floor] = {
            type: "増加",
            floors: num,
            // direction selection intentionally not exposed in modal; default to 上
            direction: direction || "上",
          };
        } else if (effect === "意味反転") {
          // Toggle meaning inversion per-floor
          const existing = window.__changeState.elevatorPerFloor[floor];
          if (existing && existing.type === "反転") {
            try {
              delete window.__changeState.elevatorPerFloor[floor];
            } catch (e) {}
          } else {
            window.__changeState.elevatorPerFloor[floor] = {
              type: "反転",
            };
          }
        } else {
          invalid();
          return;
        }

        // update magic description for elevator to reflect per-floor changes
        try {
          window.__originalAllInfo =
            window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
          const changes = window.__changeState.elevatorPerFloor || {};
          const cfg = changes[floor] || null;
          let base =
            (window.__originalAllInfo &&
              window.__originalAllInfo.box_1f &&
              window.__originalAllInfo.box_1f.content) ||
            (allInfo && allInfo.box_1f && allInfo.box_1f.content) ||
            "";
          if (typeof base === "string") base = base.replace(/\\n/g, "\n");
          let newContent = base;
          if (cfg) {
            if (cfg.type === "増加") {
              const num = cfg.floors || cfg.amount || 1;
              const dir = cfg.direction || "上";
              if (/1つ[上下]/.test(base)) {
                newContent = base.replace(/1つ[上下]/g, `${num}つ${dir}`);
              } else {
                newContent = base.replace(
                  /唱えることで[\s\S]*?移動する。/,
                  `唱えることで${num}つ${dir}の階の同じ場所に移動する。`
                );
              }
            } else if (cfg.type === "反転") {
              if (typeof base === "string") {
                if (/1つ上/.test(base)) {
                  newContent = base.replace(/1つ上/g, "1つ下");
                } else if (/1つ下/.test(base)) {
                  newContent = base.replace(/1つ下/g, "1つ上");
                } else {
                  newContent = base.replace(
                    /(唱えることで[\s\S]*?)(上|下)([\s\S]*?移動する。)/,
                    (m, p1, p2, p3) => {
                      const f = p2 === "上" ? "下" : "上";
                      return `${p1}${f}${p3}`;
                    }
                  );
                }
              }
            }
          }
          if (allInfo && allInfo.box_1f) {
            allInfo.box_1f.content = newContent;
          }
        } catch (e) {}
      } else if (target === "ムーブ") {
        // For ムーブ, only '意味反転' is applicable and it toggles
        if (effect !== "意味反転") {
          invalid();
          return;
        }
        const existingMove =
          window.__changeState.global && window.__changeState.global.move;
        if (existingMove && existingMove.type === "反転") {
          // remove inversion
          try {
            delete window.__changeState.global.move;
            // restore original text if available
            window.__originalAllInfo =
              window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
            const orig =
              (window.__originalAllInfo &&
                window.__originalAllInfo.box_3f &&
                window.__originalAllInfo.box_3f.content) ||
              "";
            if (allInfo && allInfo.box_3f) allInfo.box_3f.content = orig;
          } catch (e) {}
        } else {
          // apply inversion
          try {
            window.__changeState.global.move = { type: "反転" };
            window.__originalAllInfo =
              window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
            const base3 =
              (window.__originalAllInfo &&
                window.__originalAllInfo.box_3f &&
                window.__originalAllInfo.box_3f.content) ||
              (allInfo && allInfo.box_3f && allInfo.box_3f.content) ||
              "";
            // perform single replacement of the word '同じ' -> '違う'
            let new3;
            if (typeof base3 === "string") {
              // replace only the first occurrence
              new3 = base3.replace(/同じ/, "違う");
            } else {
              new3 = base3;
            }
            if (allInfo && allInfo.box_3f) allInfo.box_3f.content = new3;
          } catch (e) {}
        }
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
        // persist globally
        window.__changeState.global["クッショ"] = { type: "増加", amount: num };
        // update info text for cushion: replace first occurrence of '3歩' with '4歩'
        try {
          window.__originalAllInfo =
            window.__originalAllInfo || JSON.parse(JSON.stringify(allInfo));
          const baseC =
            (window.__originalAllInfo &&
              window.__originalAllInfo.box_cushion &&
              window.__originalAllInfo.box_cushion.content) ||
            (allInfo && allInfo.box_cushion && allInfo.box_cushion.content) ||
            "";
          let newC = baseC;
          if (typeof baseC === "string") {
            newC = baseC.replace(/(\d+)歩/, (m, p1) => {
              // increase by 1
              const next = String(Number(p1) + num);
              return `${next}歩`;
            });
          }
          if (allInfo && allInfo.box_cushion)
            allInfo.box_cushion.content = newC;
        } catch (e) {}
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
        // try to update a generic info entry if exists
        try {
          const keyMap = { クッショ: "box_cushion", チェンジ: "box_change" };
          const key = keyMap[target];
          if (key && allInfo && allInfo[key]) {
            allInfo[key].content =
              allInfo[key].content + "\n(チェンジで編集済み)";
          }
        } catch (e) {}
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

      try {
        showCustomAlert("チェンジを適用しました");
      } catch (e) {
        try {
          window.alert("チェンジを適用しました");
        } catch (e2) {}
      }
      modal.style.display = "none";
    });
  } else {
    modal.style.display = "flex";
  }
}
