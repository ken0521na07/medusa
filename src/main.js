import { setupUI, startTimer } from "./ui/uiSetup.js";

(async function main() {
  await setupUI();
  startTimer();
})();
