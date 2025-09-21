export function showCustomAlert(
  message,
  { timeout = 0, onClose = null, allowOverlayClose = true } = {}
) {
  // try to find existing elements
  let overlay = document.getElementById("custom-alert-overlay");
  let textEl = document.getElementById("custom-alert-text");
  let closeBtn = document.getElementById("custom-alert-close");

  // fallback: if elements are missing, create a minimal overlay so alert always appears
  if (!overlay || !textEl) {
    try {
      overlay = document.createElement("div");
      overlay.id = "custom-alert-overlay";
      overlay.className = "custom-alert-overlay";
      overlay.style.display = "none";
      const box = document.createElement("div");
      box.className = "custom-alert-box";
      textEl = document.createElement("div");
      textEl.id = "custom-alert-text";
      textEl.className = "custom-alert-text";
      closeBtn = document.createElement("button");
      closeBtn.id = "custom-alert-close";
      closeBtn.className = "puzzle-popup-close";
      closeBtn.textContent = "閉じる";
      box.appendChild(textEl);
      box.appendChild(closeBtn);
      overlay.appendChild(box);
      try {
        document.body.appendChild(overlay);
      } catch (e) {}
    } catch (e) {
      // if DOM not available, fallback to native alert
      try {
        console.log("[customAlert fallback]", message);
      } catch (e2) {}
      try {
        window.alert(message);
      } catch (e2) {}
      return;
    }
  }

  // set text and log
  try {
    textEl.textContent = message + "";
    console.log("[customAlert] show:", message);
  } catch (e) {}

  // ensure overlay visible and on top
  try {
    overlay.style.zIndex = 20000;
  } catch (e) {}
  overlay.style.display = "flex";

  // cleanup existing handlers
  const close = () => {
    overlay.style.display = "none";
    overlay.onclick = null;
    if (closeBtn) closeBtn.onclick = null;
    try {
      console.log("[customAlert] closed");
    } catch (e) {}
    if (onClose) onClose();
  };

  // attach close handler to button
  if (closeBtn) closeBtn.onclick = close;

  // attach overlay click with a slight delay to avoid the click that opened the alert
  if (allowOverlayClose) {
    setTimeout(() => {
      overlay.onclick = (e) => {
        if (e.target === overlay) close();
      };
    }, 50);
  } else {
    overlay.onclick = null;
  }

  // never auto-close from codepath: user must close explicitly
}

// 新規: 確認ダイアログを表示するユーティリティ
export function showConfirm(
  message,
  { onConfirm = null, onCancel = null, allowOverlayClose = true } = {}
) {
  let overlay = document.getElementById("confirm-overlay");
  // create if missing
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "confirm-overlay";
    overlay.className = "custom-alert-overlay"; // reuse styles
    overlay.style.display = "none";

    const box = document.createElement("div");
    box.className = "custom-alert-box";

    const text = document.createElement("div");
    text.className = "custom-alert-text";
    text.id = "confirm-text";
    box.appendChild(text);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.justifyContent = "flex-end";

    const noBtn = document.createElement("button");
    noBtn.textContent = "いいえ";
    noBtn.className = "puzzle-popup-close";

    const yesBtn = document.createElement("button");
    yesBtn.textContent = "はい";
    yesBtn.className = "puzzle-submit-btn";

    actions.appendChild(noBtn);
    actions.appendChild(yesBtn);
    box.appendChild(actions);
    overlay.appendChild(box);
    try {
      document.body.appendChild(overlay);
    } catch (e) {}

    // attach basic handlers
    yesBtn.addEventListener("click", () => {
      overlay.style.display = "none";
      if (typeof onConfirm === "function") onConfirm();
    });
    noBtn.addEventListener("click", () => {
      overlay.style.display = "none";
      if (typeof onCancel === "function") onCancel();
    });

    if (allowOverlayClose) {
      setTimeout(() => {
        overlay.onclick = (e) => {
          if (e.target === overlay) {
            overlay.style.display = "none";
            if (typeof onCancel === "function") onCancel();
          }
        };
      }, 50);
    }
  }

  // set message and show
  try {
    const text = document.getElementById("confirm-text");
    if (text) text.textContent = message + "";
  } catch (e) {}
  try {
    overlay.style.zIndex = 20001; // above customAlert
  } catch (e) {}
  overlay.style.display = "flex";
}

export function openPuzzleModal(setId) {
  const puzzleModal = document.getElementById("puzzle-modal");
  if (!puzzleModal) return;
  // Ensure page1 (list) is shown first to avoid stale grid UI
  try {
    const page1 = document.getElementById("puzzle-page-1");
    const page2 = document.getElementById("puzzle-page-2");
    if (page1) page1.style.display = "block";
    if (page2) page2.style.display = "none";
  } catch (e) {}

  puzzleModal.style.display = "flex";
  try {
    // notify listeners that the puzzle modal was just opened so they can refresh UI
    if (typeof document !== "undefined" && typeof CustomEvent === "function") {
      document.dispatchEvent(
        new CustomEvent("puzzleModalOpened", { detail: { setId } })
      );
    }
  } catch (e) {}
}
export function closePuzzleModal() {
  const puzzleModal = document.getElementById("puzzle-modal");
  if (!puzzleModal) return;
  puzzleModal.style.display = "none";
}

// expose puzzle popup functions used by puzzleManager
export const popup = {
  showPuzzlePopup: null,
  closePuzzlePopup: null,
};
