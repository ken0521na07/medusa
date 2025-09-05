import { allInfo } from "../core/constants.js";

export function renderInfoList(container) {
  if (!container) return;
  container.innerHTML = "";
  for (const key in allInfo) {
    if (allInfo[key].unlocked) {
      const li = document.createElement("li");
      li.textContent = allInfo[key].title || key;
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
  contentEl.textContent = info.content;
  if (!contentEl) return;

  // If the info content points to an image (for example info_img),
  // render the image inside the content element. Otherwise render text.
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
    contentEl.textContent = info.content || "";
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
  if (infoModal) {
    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) closeInfoModal(infoModal);
    });
  }
}
