import { allPuzzles } from "../core/constants.js";
import { setTile } from "./mapService.js";
import { openPuzzleModal } from "../ui/modals.js";

// popup DOM refs
const popupOverlay = document.getElementById("puzzle-popup-overlay");
const popupImage = document.getElementById("puzzle-popup-image");
const popupInput = document.getElementById("puzzle-popup-input");
const popupSubmit = document.getElementById("puzzle-popup-submit");
const popupClose = document.getElementById("puzzle-popup-close");

let _currentPiece = null;
let _currentSet = null;

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
        window.alert("正解！ピースを確定しました。");
      } catch (e) {}
      closePuzzlePopup();
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
    // compositionend が発火した直後に Enter キーのイベントが来る場合があるため
    // その直後の Enter を無視するフラグを短時間立てる
    _isComposing = false;
    _ignoreNextEnter = true;
    setTimeout(() => {
      _ignoreNextEnter = false;
    }, 100);
  });

  popupInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // IME の確定中または直後は送信しない
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

export function handleGetPuzzlePiece(setId, pieceId, playerPos) {
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
    setTile(playerPos.x, playerPos.y, 0);
    // show native alert indicating piece obtained
    try {
      window.alert("謎を入手した");
    } catch (e) {}
    // update UI: when opening puzzle modal, render grid will show only unlocked pieces as their images
  }
}

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
  // show modal
  openPuzzleModal();

  const puzzlePage1 = document.getElementById("puzzle-page-1");
  const puzzlePage2 = document.getElementById("puzzle-page-2");
  const puzzleGridTitle = document.getElementById("puzzle-grid-title");
  const puzzleGrid = document.getElementById("puzzle-grid");

  if (puzzleGridTitle) puzzleGridTitle.textContent = set.title || setId;
  if (puzzlePage1) puzzlePage1.style.display = "none";
  if (puzzlePage2) puzzlePage2.style.display = "flex";

  // render pieces into grid
  if (typeof renderPuzzleGrid === "function") renderPuzzleGrid(set, puzzleGrid);

  // bottom images
  const bottomWrap = document.getElementById("puzzle-bottom-images");
  const bottom1 = document.getElementById("puzzle-bottom-1");
  const bottom2 = document.getElementById("puzzle-bottom-2");
  if (bottomWrap && bottom1 && bottom2) {
    if (Array.isArray(set.bottomImages) && set.bottomImages.length >= 2) {
      bottom1.src = set.bottomImages[0] || "";
      bottom2.src = set.bottomImages[1] || "";
      bottomWrap.style.display = "flex";
    } else {
      bottom1.src = "";
      bottom2.src = "";
      bottomWrap.style.display = "none";
    }
  }
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
