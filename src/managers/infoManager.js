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
