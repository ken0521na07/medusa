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
    // highlight '1つ上' and '1つ下' and any '1つ[上下]' (apply for all keys)
    s = s.replace(/1つ[上下]/g, function (m) {
      return `<span class="change-highlight">${m}</span>`;
    });
    // highlight first occurrence of '同じ' only for move (box_3f)
    if (key === "box_3f") {
      s = s.replace(/同じ/, function (m) {
        return `<span class="change-highlight">${m}</span>`;
      });
    }
    // highlight first occurrence of '<number>歩' for cushion (box_cushion)
    if (key === "box_cushion") {
      s = s.replace(/(\d+)歩/, function (m) {
        return `<span class="change-highlight">${m}</span>`;
      });
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
