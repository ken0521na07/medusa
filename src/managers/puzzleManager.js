import { allPuzzles } from "../core/constants.js";
import { setTile } from "./mapService.js";
import { openPuzzleModal, showCustomAlert } from "../ui/modals.js";
import { emit } from "../core/eventBus.js";

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

      // also refresh puzzle list/modal UI if open
      try {
        const listEl = document.getElementById("puzzle-set-list");
        if (listEl && typeof renderPuzzleSetList === "function")
          renderPuzzleSetList(listEl);
        const modal = document.getElementById("puzzle-modal");
        if (modal && modal.style.display === "flex" && _openSetId) {
          const grid = document.getElementById("puzzle-grid");
          if (grid && typeof renderPuzzleGrid === "function")
            renderPuzzleGrid(allPuzzles[_openSetId], grid);
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
      // prefer explicit floor when provided
      setTile(
        playerPos.x,
        playerPos.y,
        0,
        typeof playerPos.floor === "number" ? playerPos.floor : undefined
      );
    // show native/custom alert indicating piece obtained unless suppressed
    try {
      if (!options.suppressAlert) {
        // prefer a suit-aware message for 1F/2F pieces; for 3F use simplified message
        const pid = String(puzzlePiece.id || "");
        const sid = String(setId || "").toLowerCase();
        let message = "謎を入手した";

        // If this is not a 3F set, try to infer suit and show the detailed message
        if (!sid.includes("3f")) {
          let suitName = null;
          if (/heart|ハート/i.test(pid)) suitName = "ハート";
          else if (/diamond|dia|ダイヤ/i.test(pid)) suitName = "ダイヤ";
          else if (/spade|スペード/i.test(pid)) suitName = "スペード";
          else if (/clover|clover|clo/i.test(pid)) suitName = "クラブ";
          else {
            // fallback to short id style like puzzle_1h / puzzle_2d etc.
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
          // 3F: simplified message per request
          message = "謎を入手した";
        }

        if (typeof showCustomAlert === "function") {
          // showCustomAlert so user must close it manually
          showCustomAlert(message, { allowOverlayClose: true });
        } else {
          window.alert(message);
        }
      }
    } catch (e) {}
    // update UI: when opening puzzle modal, render grid will show only unlocked pieces as their images

    // notify app that puzzle state changed so it can autosave
    try {
      emit("puzzleChanged");
    } catch (e) {}

    // refresh puzzle list/modal UI immediately if the puzzle modal is open
    try {
      const listEl = document.getElementById("puzzle-set-list");
      if (listEl && typeof renderPuzzleSetList === "function")
        renderPuzzleSetList(listEl);
      const modal = document.getElementById("puzzle-modal");
      if (modal && modal.style.display === "flex") {
        // if the user is currently viewing this set, re-render that grid
        if (_openSetId === setId) {
          const grid = document.getElementById("puzzle-grid");
          if (grid && typeof renderPuzzleGrid === "function")
            renderPuzzleGrid(puzzleSet, grid);
        }
      }
    } catch (e) {}
  }
}

// 新規: 指定したセット全体を入手扱いにする（3F/5F/B1 用）
export function handleGetPuzzleSet(setId, playerPos, options = {}) {
  const puzzleSet = allPuzzles[setId];
  if (!puzzleSet) return;
  if (!puzzleSet.unlocked) puzzleSet.unlocked = true;
  // unlock all pieces
  for (const p of puzzleSet.pieces) p.unlocked = true;
  // remove tile from map if position provided
  if (playerPos && typeof playerPos.x === "number")
    setTile(
      playerPos.x,
      playerPos.y,
      0,
      typeof playerPos.floor === "number" ? playerPos.floor : undefined
    );
  // show simple message
  try {
    if (!options.suppressAlert) {
      const message = "謎を入手した";
      if (typeof showCustomAlert === "function") {
        showCustomAlert(message, { allowOverlayClose: true });
      } else {
        window.alert(message);
      }
    }
  } catch (e) {}

  // notify app that puzzle state changed so it can autosave
  try {
    emit("puzzleChanged");
  } catch (e) {}

  // refresh puzzle list/modal UI immediately if the puzzle modal is open
  try {
    const listEl = document.getElementById("puzzle-set-list");
    if (listEl && typeof renderPuzzleSetList === "function")
      renderPuzzleSetList(listEl);
    const modal = document.getElementById("puzzle-modal");
    if (modal && modal.style.display === "flex") {
      // render this set's grid if it's currently open
      if (_openSetId === setId) {
        const grid = document.getElementById("puzzle-grid");
        if (grid && typeof renderPuzzleGrid === "function")
          renderPuzzleGrid(puzzleSet, grid);
      }
    }
  } catch (e) {}
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

  // remember which set is open so we can refresh it from pickups
  _openSetId = setId;

  // render pieces into grid
  if (typeof renderPuzzleGrid === "function") renderPuzzleGrid(set, puzzleGrid);

  // bottom images
  const bottomWrap = document.getElementById("puzzle-bottom-images");
  const bottom1 = document.getElementById("puzzle-bottom-1");
  const bottom2 = document.getElementById("puzzle-bottom-2");
  if (bottomWrap && bottom1 && bottom2) {
    try {
      // If this is an elevator puzzle set, prefer per-floor change state to
      // compute dynamic bottom images named like:
      // img/elevtext_(inc)_(up|down).png
      // img/elevbox_(inc)_(up|down).png
      // Note: per user request, the "box" image uses the opposite direction
      // to the elevator "dir" (example: dir=下 -> elevtext_2_down, elevbox_2_up).
      const isElevator = String(setId || "")
        .toLowerCase()
        .startsWith("elevator_");
      if (isElevator) {
        // map setId -> floor number (e.g. elevator_1f -> 1, elevator_b1 -> 0)
        let floor = null;
        const id = String(setId || "").toLowerCase();
        if (id.includes("1f")) floor = 1;
        else if (id.includes("2f")) floor = 2;
        else if (id.includes("3f")) floor = 3;
        else if (id.includes("4f")) floor = 4;
        else if (id.includes("5f")) floor = 5;
        else if (id.includes("b1")) floor = 0;

        // default images
        let img1 =
          (Array.isArray(set.bottomImages) && set.bottomImages[0]) ||
          "img/elevtext_1_up.png";
        let img2 =
          (Array.isArray(set.bottomImages) && set.bottomImages[1]) ||
          "img/elevbox_1_up.png";

        try {
          window.__changeState = window.__changeState || {};
          const per =
            (window.__changeState.elevatorPerFloor || {})[floor] || null;
          // Only compute dynamic images when a per-floor config exists.
          if (per) {
            // derive stored inc and dir (fall back to reasonable defaults)
            const storedInc =
              typeof per.inc === "number" ? Math.max(0, per.inc) : 0;
            // displayed count is base (1) + storedInc
            const displayCount = storedInc + 1;
            const dir =
              per.dir || per.direction || (per.type === "反転" ? "下" : "上");
            const dirMap = { 上: "up", 下: "down" };
            const dirStr = dirMap[dir] || "up";
            // box image uses opposite direction per user's example
            const boxOpp = dir === "上" ? "down" : "up";

            img1 = `img/elevtext_${displayCount}_${dirStr}.png`;
            img2 = `img/elevbox_${displayCount}_${boxOpp}.png`;
          }
        } catch (e) {
          // leave defaults if anything goes wrong
        }

        // bottom1.src = img1;
        // bottom2.src = img2;
        // bottomWrap.style.display = "flex";
      } else {
        if (Array.isArray(set.bottomImages) && set.bottomImages.length >= 2) {
          // bottom1.src = set.bottomImages[0] || "";
          // bottom2.src = set.bottomImages[1] || "";
          // bottomWrap.style.display = "flex";
        } else {
          // bottom1.src = "";
          // bottom2.src = "";
          // bottomWrap.style.display = "none";
        }
      }
    } catch (e) {
      // fallback to original behavior if something fails
      if (Array.isArray(set.bottomImages) && set.bottomImages.length >= 2) {
        // bottom1.src = set.bottomImages[0] || "";
        // bottom2.src = set.bottomImages[1] || "";
        // bottomWrap.style.display = "flex";
      } else {
        // bottom1.src = "";
        // bottom2.src = "";
        // bottomWrap.style.display = "none";
      }
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

// Serialize puzzle state (unlocked flags and solved answers)
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

// Deserialize puzzle state produced by serialize()
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
