// Simple state manager: save/load game state to localStorage
const SAVE_KEY = "medusa_save_v1";

export function save(state) {
  try {
    const payload = {
      meta: {
        version: 1,
        ts: Date.now(),
      },
      state: state || {},
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("stateManager.save failed", e);
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.state ? parsed.state : null;
  } catch (e) {
    console.error("stateManager.load failed", e);
    return null;
  }
}

export function clear() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    console.error("stateManager.clear failed", e);
    return false;
  }
}

export default {
  save,
  load,
  clear,
};
