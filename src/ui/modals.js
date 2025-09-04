export function showCustomAlert(
  message,
  {
    autoClose = false,
    timeout = 0,
    onClose = null,
    allowOverlayClose = true,
  } = {}
) {
  const overlay = document.getElementById("custom-alert-overlay");
  const textEl = document.getElementById("custom-alert-text");
  const closeBtn = document.getElementById("custom-alert-close");
  if (!overlay || !textEl) return;
  textEl.textContent = message + "";
  // debug: always log alerts to console for easier testing
  try {
    console.log("[customAlert] show:", message);
  } catch (e) {}
  // ensure overlay is on top
  try {
    overlay.style.zIndex = 20000;
  } catch (e) {}
  overlay.style.display = "flex";

  // clear any previous handlers to avoid duplicates
  const close = () => {
    overlay.style.display = "none";
    // cleanup handlers
    overlay.onclick = null;
    if (closeBtn) closeBtn.onclick = null;
    try {
      console.log("[customAlert] closed");
    } catch (e) {}
    if (onClose) onClose();
  };

  // attach overlay click only if allowed
  if (allowOverlayClose) {
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
  } else {
    // ensure overlay doesn't close on accidental clicks for a short period
    overlay.onclick = null;
  }
  if (closeBtn) closeBtn.onclick = close;
  if (autoClose && timeout > 0) setTimeout(close, timeout);
}

export function openPuzzleModal(setId) {
  const puzzleModal = document.getElementById("puzzle-modal");
  if (!puzzleModal) return;
  puzzleModal.style.display = "flex";
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
