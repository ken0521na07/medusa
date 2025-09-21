import { setupUI } from "./ui/uiSetup.js";

// initialize game
(async () => {
  try {
    await setupUI();
  } catch (e) {}

  // Wire reset button for clearing saved state
  try {
    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        try {
          // set flag to prevent autosave during reset
          try {
            if (typeof window !== "undefined") window.__skipSaving = true;
          } catch (e) {}

          // Try to use stateManager.clear if available synchronously
          try {
            // dynamic import then call clear and reload
            import("./managers/stateManager.js").then((m) => {
              try {
                if (m && typeof m.clear === "function") {
                  try {
                    m.clear();
                  } catch (e) {
                    try {
                      localStorage.removeItem("medusa_save_v1");
                    } catch (ex) {}
                  }
                } else {
                  try {
                    localStorage.removeItem("medusa_save_v1");
                  } catch (ex) {}
                }
              } catch (err) {
                try {
                  localStorage.removeItem("medusa_save_v1");
                } catch (ex) {}
              }
              try {
                // small timeout to ensure any pending save is cancelled
                setTimeout(() => {
                  try {
                    window.location.reload();
                  } catch (e) {}
                }, 50);
              } catch (e) {}
            });
          } catch (e) {
            try {
              localStorage.removeItem("medusa_save_v1");
              setTimeout(() => {
                try {
                  window.location.reload();
                } catch (ex) {}
              }, 50);
            } catch (ex) {}
          }
        } catch (e) {
          try {
            localStorage.removeItem("medusa_save_v1");
            window.location.reload();
          } catch (ex) {}
        }
      });
    }
  } catch (e) {}
})();
