import { allPuzzles } from "../core/constants.js";
import { setTile } from "./mapService.js";
import {
  openPuzzleModal,
  closePuzzleModal,
  showCustomAlert,
} from "../ui/modals.js";
import { emit } from "../core/eventBus.js";
import * as mapService from "./mapService.js";

// popup DOM refs
const popupOverlay = document.getElementById("puzzle-popup-overlay");
const popupImage = document.getElementById("puzzle-popup-image");
const popupInput = document.getElementById("puzzle-popup-input");
const popupSubmit = document.getElementById("puzzle-popup-submit");
const popupClose = document.getElementById("puzzle-popup-close");

let _currentPiece = null;
let _currentSet = null;
// track the setId currently displayed in the puzzle modal (if any)
let _openSetId = null;

function showPuzzlePopup(piece, puzzleSet) {
  _currentPiece = piece;
  _currentSet = puzzleSet;
  if (!popupOverlay) return;
  popupImage.src = piece.image || "";
  popupImage.alt = piece.id || "";
  if (piece.solvedAnswer) {
    popupInput.value = piece.solvedAnswer;
    popupInput.disabled = true;
    if (popupSubmit) popupSubmit.disabled = true;
  } else {
    popupInput.value = "";
    popupInput.disabled = false;
    if (popupSubmit) popupSubmit.disabled = false;
  }
  popupOverlay.style.display = "flex";
  if (!popupInput.disabled) popupInput.focus();
}

function closePuzzlePopup() {
  if (!popupOverlay) return;
  popupOverlay.style.display = "none";
  _currentPiece = null;
  _currentSet = null;
}

if (popupClose) popupClose.addEventListener("click", closePuzzlePopup);
if (popupOverlay)
  popupOverlay.addEventListener("click", (e) => {
    if (e.target === popupOverlay) closePuzzlePopup();
  });

// Ensure puzzle modal has overlay click and close/back handlers so it can be dismissed
try {
  const modal = document.getElementById("puzzle-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePuzzleModal();
    });
    const closeBtn = document.getElementById("puzzle-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", () => closePuzzleModal());
    const backBtn = document.getElementById("puzzle-back-btn");
    if (backBtn)
      backBtn.addEventListener("click", () => {
        const p1 = document.getElementById("puzzle-page-1");
        const p2 = document.getElementById("puzzle-page-2");
        if (p2) p2.style.display = "none";
        if (p1) p1.style.display = "block";
      });
  }
} catch (e) {}

if (popupSubmit) {
  popupSubmit.addEventListener("click", () => {
    if (!_currentPiece || !_currentSet) return;
    if (_currentPiece.solvedAnswer) return;
    const raw = (popupInput.value || "").trim();
    const val = raw.toLowerCase();
    const answers = (_currentPiece.answers || []).map((a) =>
      a.trim().toLowerCase()
    );
    const isValid = answers.some((a) => a === val);
    if (isValid) {
      _currentPiece.unlocked = true;
      _currentPiece.solvedAnswer = raw;
      if (!_currentSet.unlocked) _currentSet.unlocked = true;
      // re-render current grid
      const puzzleGrid = document.getElementById("puzzle-grid");
      renderPuzzleGrid(_currentSet, puzzleGrid);
      try {
        window.alert("正解！");
      } catch (e) {}
      closePuzzlePopup();

      // notify app that puzzle state changed so it can autosave (solved answer)
      try {
        emit("puzzleChanged");
      } catch (e) {}

      // always refresh puzzle modal UI after puzzle state changes so it never
      // becomes stale (especially when picking up multiple pieces on same floor)
      try {
        if (typeof refreshOpenModal === "function") {
          // slight delay ensures any DOM changes settle before re-render
          setTimeout(() => {
            try {
              refreshOpenModal();
            } catch (e) {}
          }, 50);
        }
      } catch (e) {}

      // ensure any open puzzle modal refreshes its current view immediately
      try {
        const modal = document.getElementById("puzzle-modal");
        if (modal && modal.style.display === "flex") {
          try {
            // Close the modal when a puzzle is correctly solved / picked up.
            if (typeof closePuzzleModal === "function") closePuzzleModal();
          } catch (e) {}
          try {
            // Ensure state is reset so next open shows page1 and fresh list
            _openSetId = null;
            const listEl = document.getElementById("puzzle-set-list");
            if (listEl && typeof renderPuzzleSetList === "function")
              renderPuzzleSetList(listEl);
          } catch (e) {}
        } else {
          try {
            if (typeof refreshOpenModal === "function") refreshOpenModal();
          } catch (e) {}
        }
      } catch (e) {}

      // also refresh puzzle list/modal UI unconditionally to avoid stale UI
      try {
        const listEl = document.getElementById("puzzle-set-list");
        if (listEl && typeof renderPuzzleSetList === "function")
          renderPuzzleSetList(listEl);
        const modal3 = document.getElementById("puzzle-modal");
        if (modal3 && modal3.style.display === "flex") {
          const grid = document.getElementById("puzzle-grid");
          if (grid && typeof renderPuzzleGrid === "function") {
            if (_openSetId && allPuzzles[_openSetId])
              renderPuzzleGrid(allPuzzles[_openSetId], grid);
            else renderPuzzleGrid(_currentSet, grid);
          }
        }
      } catch (e) {}
    } else {
      try {
        window.alert("不正解です。もう一度試してください。");
      } catch (e) {}
    }
  });
}

// Enter キーで送信できるようにする（IME 対策）
if (popupInput) {
  let _isComposing = false;
  let _ignoreNextEnter = false;

  popupInput.addEventListener("compositionstart", () => {
    _isComposing = true;
  });
  popupInput.addEventListener("compositionend", () => {
    _isComposing = false;
    _ignoreNextEnter = true;
    setTimeout(() => {
      _ignoreNextEnter = false;
    }, 100);
  });

  popupInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (_isComposing || _ignoreNextEnter) return;
      e.preventDefault();
      if (popupSubmit && !popupSubmit.disabled) {
        popupSubmit.click();
      }
    }
  });
}

export function getPuzzleSets() {
  return allPuzzles;
}

export function handleGetPuzzlePiece(setId, pieceId, playerPos, options = {}) {
  const puzzleSet = allPuzzles[setId];
  if (!puzzleSet) return;
  const puzzlePiece = puzzleSet.pieces.find((p) => p.id === pieceId);
  if (!puzzlePiece) return;
  if (!puzzlePiece.unlocked) {
    // mark only this piece unlocked
    puzzlePiece.unlocked = true;
    // ensure set is marked unlocked
    if (!puzzleSet.unlocked) puzzleSet.unlocked = true;
    // remove from map
    if (playerPos && typeof playerPos.x === "number")
      setTile(
        playerPos.x,
        playerPos.y,
        0,
        typeof playerPos.floor === "number" ? playerPos.floor : undefined
      );

    // ensure overlay is updated immediately for this tile (remove puzzle overlay)
    try {
      const floor =
        typeof playerPos?.floor === "number"
          ? playerPos.floor
          : mapService.getFloor();
      if (
        window &&
        window.__overlayManager &&
        typeof window.__overlayManager._refreshOverlayAt === "function"
      ) {
        try {
          window.__overlayManager._refreshOverlayAt(
            playerPos.x,
            playerPos.y,
            floor,
            mapService.getFloor()
          );
        } catch (e) {}
      }
    } catch (e) {}

    // show native/custom alert indicating piece obtained unless suppressed
    try {
      if (!options.suppressAlert) {
        const pid = String(puzzlePiece.id || "");
        const sid = String(setId || "").toLowerCase();
        let message = "謎を入手した";

        if (!sid.includes("3f")) {
          let suitName = null;
          if (/heart|ハート/i.test(pid)) suitName = "ハート";
          else if (/diamond|dia|ダイヤ/i.test(pid)) suitName = "ダイヤ";
          else if (/spade|スペード/i.test(pid)) suitName = "スペード";
          else if (/clover|clover|clo/i.test(pid)) suitName = "クラブ";
          else {
            if (/_?\w*h$|1h|2h/i.test(pid)) suitName = "ハート";
            else if (/_?\w*d$|1d|2d/i.test(pid)) suitName = "ダイヤ";
            else if (/_?\w*c$|1c|2c/i.test(pid)) suitName = "クラブ";
            else if (/_?\w*s$|1s|2s/i.test(pid)) suitName = "スペード";
          }

          if (suitName) {
            message = `(${suitName})の謎を入手した。画面の【謎】ボタンから入手した謎を確認できます`;
          } else {
            message =
              "謎を入手した。画面の【謎】ボタンから入手した謎を確認できます";
          }
        } else {
          message = "謎を入手した";
        }

        try {
          console.log(
            `[puzzle] picked up piece: set=${setId} piece=${puzzlePiece.id} at=${playerPos?.x},${playerPos?.y},f=${playerPos?.floor}`
          );
        } catch (e) {}

        if (typeof showCustomAlert === "function") {
          showCustomAlert(message, { allowOverlayClose: true });
        } else {
          window.alert(message);
        }
      }
    } catch (e) {}

    try {
      emit("puzzleChanged");
    } catch (e) {}

    // always refresh puzzle modal UI after puzzle state changes so it never
    // becomes stale (especially when picking up multiple pieces on same floor)
    try {
      if (typeof refreshOpenModal === "function") {
        // slight delay ensures any DOM changes settle before re-render
        setTimeout(() => {
          try {
            refreshOpenModal();
          } catch (e) {}
        }, 50);
      }
    } catch (e) {}

    try {
      const modal = document.getElementById("puzzle-modal");
      if (modal && modal.style.display === "flex") {
        try {
          // Close the modal when a puzzle is correctly solved / picked up.
          if (typeof closePuzzleModal === "function") closePuzzleModal();
        } catch (e) {}
        try {
          // Ensure state is reset so next open shows page1 and fresh list
          _openSetId = null;
          const listEl = document.getElementById("puzzle-set-list");
          if (listEl && typeof renderPuzzleSetList === "function")
            renderPuzzleSetList(listEl);
        } catch (e) {}
      } else {
        try {
          if (typeof refreshOpenModal === "function") refreshOpenModal();
        } catch (e) {}
      }
    } catch (e) {}

    try {
      const listEl = document.getElementById("puzzle-set-list");
      if (listEl && typeof renderPuzzleSetList === "function")
        renderPuzzleSetList(listEl);
      const modal3 = document.getElementById("puzzle-modal");
      if (modal3 && modal3.style.display === "flex") {
        const grid = document.getElementById("puzzle-grid");
        if (grid && typeof renderPuzzleGrid === "function") {
          if (_openSetId && allPuzzles[_openSetId])
            renderPuzzleGrid(allPuzzles[_openSetId], grid);
          else renderPuzzleGrid(_currentSet, grid);
        }
      }
    } catch (e) {}
  } else {
    try {
      window.alert("不正解です。もう一度試してください。");
    } catch (e) {}
  }
}

// 新規: 指定したセット全体を入手扱いにする（3F/5F/B1 用）
export function handleGetPuzzleSet(setId, playerPos, options = {}) {
  const puzzleSet = allPuzzles[setId];
  if (!puzzleSet) return;
  if (!puzzleSet.unlocked) puzzleSet.unlocked = true;
  for (const p of puzzleSet.pieces) p.unlocked = true;
  if (playerPos && typeof playerPos.x === "number")
    setTile(
      playerPos.x,
      playerPos.y,
      0,
      typeof playerPos.floor === "number" ? playerPos.floor : undefined
    );
  try {
    if (!options.suppressAlert) {
      const message = "謎を入手した";
      try {
        console.log(
          `[puzzle] picked up set: set=${setId} at=${playerPos?.x},${playerPos?.y},f=${playerPos?.floor}`
        );
      } catch (e) {}
      if (typeof showCustomAlert === "function") {
        showCustomAlert(message, { allowOverlayClose: true });
      } else {
        window.alert(message);
      }
    }
  } catch (e) {}

  try {
    emit("puzzleChanged");
  } catch (e) {}

  // always refresh puzzle modal UI after puzzle state changes so it never
  // becomes stale (especially when picking up entire sets)
  try {
    if (typeof refreshOpenModal === "function") {
      setTimeout(() => {
        try {
          refreshOpenModal();
        } catch (e) {}
      }, 50);
    }
  } catch (e) {}

  try {
    const modal = document.getElementById("puzzle-modal");
    if (modal && modal.style.display === "flex") {
      try {
        if (typeof closePuzzleModal === "function") closePuzzleModal();
      } catch (e) {}
      try {
        setTimeout(() => {
          try {
            const modal2 = document.getElementById("puzzle-modal");
            const page1 = document.getElementById("puzzle-page-1");
            const page2 = document.getElementById("puzzle-page-2");
            if (page1) page1.style.display = "block";
            if (page2) page2.style.display = "none";
            if (modal2) modal2.style.display = "flex";
            _openSetId = null;
            const listEl2 = document.getElementById("puzzle-set-list");
            if (listEl2 && typeof renderPuzzleSetList === "function")
              renderPuzzleSetList(listEl2);
          } catch (e) {}
        }, 50);
      } catch (e) {}
    } else {
      const listEl = document.getElementById("puzzle-set-list");
      if (listEl && typeof renderPuzzleSetList === "function")
        renderPuzzleSetList(listEl);
    }
  } catch (e) {}

  try {
    if (
      window &&
      window.__overlayManager &&
      typeof window.__overlayManager.refreshOverlaysForFloor === "function"
    ) {
      try {
        const floor =
          typeof playerPos?.floor === "number"
            ? playerPos.floor
            : mapService.getFloor();
        window.__overlayManager.refreshOverlaysForFloor(floor);
      } catch (e) {}
    }
  } catch (e) {}
}

// Ensure we refresh modal content when it's opened externally
try {
  if (typeof document !== "undefined") {
    document.addEventListener("puzzleModalOpened", (e) => {
      try {
        const setId = e && e.detail && e.detail.setId;
        // If modal opened without a specific setId, always reset to page1 and
        // clear any remembered open set. This prevents remembering the last
        // opened page between openings.
        if (typeof setId === "undefined" || setId === null) {
          _openSetId = null;
          const page1 = document.getElementById("puzzle-page-1");
          const page2 = document.getElementById("puzzle-page-2");
          try {
            if (page1) page1.style.display = "block";
            if (page2) page2.style.display = "none";
          } catch (e2) {}
          const listEl = document.getElementById("puzzle-set-list");
          if (listEl && typeof renderPuzzleSetList === "function")
            renderPuzzleSetList(listEl);
          return;
        }

        const target = setId || _openSetId;
        if (target) {
          const grid = document.getElementById("puzzle-grid");
          if (
            grid &&
            typeof renderPuzzleGrid === "function" &&
            allPuzzles[target]
          ) {
            renderPuzzleGrid(allPuzzles[target], grid);
          }
        }
      } catch (err) {}
    });
  }
} catch (e) {}

export function renderPuzzleSetList(container) {
  if (!container) return;
  container.innerHTML = "";
  const unlockedEntries = Object.keys(allPuzzles).filter(
    (setId) => allPuzzles[setId].unlocked
  );
  if (unlockedEntries.length === 0) {
    const li = document.createElement("li");
    li.textContent =
      "解放された謎はありません。まずはマップ上でかけらを入手してください。";
    li.style.opacity = "0.7";
    li.style.cursor = "default";
    container.appendChild(li);
    return;
  }
  unlockedEntries.forEach((setId) => {
    const set = allPuzzles[setId];
    const li = document.createElement("li");
    li.textContent = set.title || setId;
    li.style.cursor = "pointer";
    li.addEventListener("click", () => openPuzzleSet(setId));
    container.appendChild(li);
  });
}

export function openPuzzleSet(setId) {
  const set = allPuzzles[setId];
  if (!set) return;
  try {
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent("puzzleModalWillOpen", { detail: { setId } })
      );
    }
  } catch (e) {}
  openPuzzleModal(setId);

  const puzzlePage1 = document.getElementById("puzzle-page-1");
  const puzzlePage2 = document.getElementById("puzzle-page-2");
  const puzzleGridTitle = document.getElementById("puzzle-grid-title");
  const puzzleGrid = document.getElementById("puzzle-grid");

  if (puzzleGridTitle) puzzleGridTitle.textContent = set.title || setId;

  // When opening a specific set from the list, show page2 (the grid) so the
  // user sees the pieces immediately. Page1 remains the default when the
  // modal is opened generally (handled in openPuzzleModal).
  try {
    if (puzzlePage1) puzzlePage1.style.display = "none";
    if (puzzlePage2) puzzlePage2.style.display = "flex";
  } catch (e) {}

  _openSetId = setId;

  if (typeof renderPuzzleGrid === "function") renderPuzzleGrid(set, puzzleGrid);
}

export function renderPuzzleGrid(set, container) {
  if (!container || !set) return;
  container.innerHTML = "";
  set.pieces.forEach((piece) => {
    const pieceEl = document.createElement("div");
    pieceEl.classList.add("puzzle-piece");
    const img = document.createElement("img");
    img.alt = piece.id;

    if (piece.solvedAnswer) {
      img.src = piece.image;
      pieceEl.classList.add("solved");
      pieceEl.classList.remove("locked");
      pieceEl.style.pointerEvents = "";
      pieceEl.addEventListener("click", () => {
        showPuzzlePopup(piece, set);
      });
    } else if (piece.unlocked) {
      img.src = piece.image;
      pieceEl.classList.remove("solved");
      pieceEl.classList.remove("locked");
      pieceEl.style.pointerEvents = "";
      pieceEl.addEventListener("click", () => {
        showPuzzlePopup(piece, set);
      });
    } else {
      img.src = "img/nazo_locked.png";
      pieceEl.classList.add("locked");
      pieceEl.classList.remove("solved");
      pieceEl.style.pointerEvents = "none";
    }

    pieceEl.appendChild(img);
    container.appendChild(pieceEl);
  });
}

export function serialize() {
  try {
    const out = {};
    for (const setId of Object.keys(allPuzzles)) {
      const set = allPuzzles[setId];
      out[setId] = {
        unlocked: !!set.unlocked,
        pieces: {},
      };
      if (Array.isArray(set.pieces)) {
        for (const p of set.pieces) {
          if (!p || !p.id) continue;
          out[setId].pieces[p.id] = {
            unlocked: !!p.unlocked,
            solvedAnswer:
              typeof p.solvedAnswer === "string" ? p.solvedAnswer : null,
          };
        }
      }
    }
    return out;
  } catch (e) {
    console.error("puzzleManager.serialize failed", e);
    return null;
  }
}

export function deserialize(payload) {
  try {
    if (!payload || typeof payload !== "object") return;
    for (const setId of Object.keys(payload)) {
      const savedSet = payload[setId];
      const set = allPuzzles[setId];
      if (!set) continue;
      if (typeof savedSet.unlocked === "boolean")
        set.unlocked = savedSet.unlocked;
      if (
        savedSet.pieces &&
        typeof savedSet.pieces === "object" &&
        Array.isArray(set.pieces)
      ) {
        for (const p of set.pieces) {
          const sp = savedSet.pieces[p.id];
          if (!sp) continue;
          if (typeof sp.unlocked === "boolean") p.unlocked = sp.unlocked;
          if (typeof sp.solvedAnswer === "string")
            p.solvedAnswer = sp.solvedAnswer;
        }
      }
    }
  } catch (e) {
    console.error("puzzleManager.deserialize failed", e);
  }
}

export function refreshOpenModal() {
  try {
    const modal = document.getElementById("puzzle-modal");
    if (!modal || modal.style.display !== "flex") return;
    const listEl = document.getElementById("puzzle-set-list");
    if (listEl && typeof renderPuzzleSetList === "function")
      renderPuzzleSetList(listEl);
    if (_openSetId) {
      const grid = document.getElementById("puzzle-grid");
      if (grid && typeof renderPuzzleGrid === "function")
        renderPuzzleGrid(allPuzzles[_openSetId], grid);
    }
  } catch (e) {
    console.error("refreshOpenModal failed", e);
  }
}
