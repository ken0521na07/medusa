import { allInfo } from "../core/constants.js";

export function renderInfoList(container) {
  if (!container) return;
  container.innerHTML = "";
  for (const key in allInfo) {
    // exclude box_* entries from the general info modal; they belong to the magic modal
    if (key && key.startsWith && key.startsWith("box_")) continue;
    if (allInfo[key].unlocked) {
      const li = document.createElement("li");
      li.textContent = allInfo[key].title || key;
      li.dataset.key = key;
      li.style.cursor = "pointer";
      container.appendChild(li);
    }
  }
}

export function renderMagicList(container) {
  if (!container) return;
  container.innerHTML = "";
  // show only magic-related info keys (box_*)
  for (const key of ["box_1f", "box_3f", "box_cushion", "box_change"]) {
    const info = allInfo[key];
    if (info && info.unlocked) {
      const li = document.createElement("li");
      li.textContent = info.title || key;
      li.dataset.key = key;
      li.style.cursor = "pointer";
      container.appendChild(li);
    }
  }
}

export function openInfoModal(modal, page1, page2, listContainer) {
  if (!modal) return;
  renderInfoList(listContainer);
  page1.style.display = "block";
  page2.style.display = "none";
  modal.style.display = "flex";
}
export function closeInfoModal(modal) {
  if (!modal) return;
  modal.style.display = "none";
}

export function showInfoDetail(infoKey, titleEl, contentEl) {
  const info = allInfo[infoKey];
  if (!info) return;
  titleEl.textContent = info.title;
  // highlight certain changeable phrases (always red regardless of change state)
  function highlightContent(raw, key) {
    if (typeof raw !== "string") return raw || "";
    let s = raw;
    // ensure we don't double-wrap by removing existing spans first
    s = s.replace(/<span class="change-highlight">([\s\S]*?)<\/span>/g, "$1");

    try {
      if (key === "box_1f") {
        // highlight phrases like '1つ上' / '2つ下' (require 'つ' token to avoid matching '魔法陣の上')
        s = s.replace(/([一二三四五六七八九十]+|\d+)つ[上下]/g, function (m) {
          return `<span class="change-highlight">${m}</span>`;
        });
      } else if (key === "box_cushion") {
        // highlight numeric part of '3歩' (or any number + 歩)
        s = s.replace(/(\d+)歩/g, function (m, n) {
          return `<span class="change-highlight">${n}</span>歩`;
        });
      } else if (key === "box_3f") {
        // Ensure the displayed token matches current チェンジの状況 for ムーブ (per-floor preferred)
        try {
          const player =
            typeof window !== "undefined" && window.__playerInstance
              ? window.__playerInstance
              : null;
          const floor = player ? player.floor : null;
          const perFloorMove =
            typeof window !== "undefined" &&
            window.__changeStateByFloor &&
            floor != null
              ? window.__changeStateByFloor[floor] &&
                window.__changeStateByFloor[floor]["ムーブ"]
              : null;
          const globalMove =
            typeof window !== "undefined" &&
            window.__changeState &&
            window.__changeState.global
              ? window.__changeState.global["ムーブ"] ||
                window.__changeState.global["move"]
              : null;
          const moveCfg = perFloorMove || globalMove;
          const moveIsInverted = (() => {
            const c = moveCfg;
            if (!c) return false;
            if (c.type === "反転") return true;
            if (c.invert === true || c.reversed === true || c.revert === true)
              return true;
            if (c.dir === "下" || c.direction === "下") return true;
            return false;
          })();

          if (moveIsInverted) {
            // show '違う' instead of '同じ'
            // perform a safe swap in case content already contains '違う'
            s = s.replace(/同じ/g, "__TMP_SAME__");
            s = s.replace(/違う/g, "同じ");
            s = s.replace(/__TMP_SAME__/g, "違う");
          } else {
            // ensure '同じ' is shown (swap back if needed)
            s = s.replace(/違う/g, "__TMP_DIFF__");
            s = s.replace(/同じ/g, "違う");
            s = s.replace(/__TMP_DIFF__/g, "同じ");
            // The above ensures that if content was previously modified to '違う', it is restored to '同じ'.
          }
        } catch (e) {
          // ignore errors and fall back to existing highlighting behavior
        }
        // highlight '同じ' or '違う' depending on current content after swap
        if (/違う/.test(s)) {
          s = s.replace(/違う/, `<span class="change-highlight">違う</span>`);
        } else {
          s = s.replace(/同じ/, `<span class="change-highlight">同じ</span>`);
        }
      }
    } catch (e) {
      // ignore highlight errors
    }

    return s;
  }
  const maybeImg = info.content || "";
  if (
    typeof maybeImg === "string" &&
    maybeImg.match(/\.(png|jpg|jpeg|gif)$/i)
  ) {
    contentEl.innerHTML = "";
    const img = document.createElement("img");
    img.src = maybeImg;
    img.alt = info.title || infoKey;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    contentEl.appendChild(img);
  } else {
    // render HTML with highlighted substrings; pass infoKey so elevator doesn't highlight '同じ'
    contentEl.innerHTML = highlightContent(info.content || "", infoKey);
  }

  // Switch modal to page 2 (detail view) if pages exist. This ensures
  // clicking an info entry always navigates to the detail page.
  try {
    const page1 = document.getElementById("info-page-1");
    const page2 = document.getElementById("info-page-2");
    if (page1 && page2) {
      page1.style.display = "none";
      page2.style.display = "flex";
    }
  } catch (e) {
    // ignore in non-browser environments
  }
}

export function initInfoModalHandlers() {
  const infoModal = document.getElementById("info-modal");
  const infoPage1 = document.getElementById("info-page-1");
  const infoPage2 = document.getElementById("info-page-2");
  const infoList = document.getElementById("info-list");
  if (infoList) {
    infoList.addEventListener("click", (event) => {
      if (event.target.tagName === "LI") {
        const key = event.target.dataset.key;
        showInfoDetail(
          key,
          document.getElementById("info-detail-title"),
          document.getElementById("info-detail-content")
        );
      }
    });
  }
  // magic modal handlers
  const magicModal = document.getElementById("keyword-modal");
  const magicPage1 = document.getElementById("magic-page-1");
  const magicPage2 = document.getElementById("magic-page-2");
  const magicList = document.getElementById("magic-list");
  if (magicList) {
    magicList.addEventListener("click", (event) => {
      // support clicks on inner nodes by finding the closest LI
      const li = event.target.closest && event.target.closest("li");
      if (!li) return;
      const key = li.dataset.key;
      showInfoDetail(
        key,
        document.getElementById("magic-detail-title"),
        document.getElementById("magic-detail-content")
      );
      // explicitly switch magic modal to detail page
      try {
        const magicPage1 = document.getElementById("magic-page-1");
        const magicPage2 = document.getElementById("magic-page-2");
        if (magicPage1 && magicPage2) {
          magicPage1.style.display = "none";
          magicPage2.style.display = "flex";
        }
      } catch (e) {
        // ignore in non-browser env
      }
    });
  }
  const magicClose = document.getElementById("keyword-close-btn");
  if (magicClose)
    magicClose.addEventListener("click", () => {
      if (magicModal) magicModal.style.display = "none";
    });
  // page2 close (top-right ×) for magic
  const magicClose2 = document.getElementById("keyword-close2-btn");
  if (magicClose2)
    magicClose2.addEventListener("click", () => {
      if (magicModal) magicModal.style.display = "none";
    });
  const magicBack = document.getElementById("keyword-back-btn");
  if (magicBack)
    magicBack.addEventListener("click", () => {
      if (magicPage2) magicPage2.style.display = "none";
      if (magicPage1) magicPage1.style.display = "block";
    });
  // overlay click closes magic modal as well
  if (magicModal) {
    magicModal.addEventListener("click", (e) => {
      if (e.target === magicModal) magicModal.style.display = "none";
    });
  }
  if (infoModal) {
    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) closeInfoModal(infoModal);
    });
    // page2 close (top-right ×) for info
    const infoClose2 = document.getElementById("info-close2-btn");
    if (infoClose2)
      infoClose2.addEventListener("click", () => {
        closeInfoModal(infoModal);
      });
  }
}

// append CSS rule for highlight class when document exists
try {
  if (typeof document !== "undefined") {
    const styleId = "change-highlight-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent =
        ".change-highlight { color: red; font-weight: bold; }";
      document.head.appendChild(style);
    }
  }
} catch (e) {}
