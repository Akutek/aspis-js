/** @typedef {import("../types/utils.js").ObserverTarget} ObserverTarget */
/** @typedef {import("../types/registry.js").Registry} Registry */
import { BaseObserver } from "./BaseObserver.js";
import { ScannerDOM } from "./ScannerDOM.js";
import { DebugAgent } from "../agents/DebugAgent.js";
import { Main } from "../core/Main.js";
class MutationObserverDOM extends BaseObserver {
  #nativeObserver = null;
  start(target = document.body, config = { childList: true, subtree: true }) {
    if (this.isObserving) return;
    this.#nativeObserver = new MutationObserver((mutations) => this.#handleMutations(mutations));
    this.#nativeObserver.observe(target, config);
    super.start(target);
    DebugAgent.info("[MutationObserverDOM.start()] Aspis [MutationObserverDOM]: W\xE4chter aktiv.");
  }
  observe(target, config = { childList: true, subtree: true }) {
    if (!(target instanceof Node)) return;
    super.observe(target);
    if (this.#nativeObserver) {
      this.#nativeObserver.observe(target, config);
    }
  }
  stop() {
    if (this.#nativeObserver) {
      this.#nativeObserver.disconnect();
      this.#nativeObserver = null;
    }
    super.stop();
    DebugAgent.info("[MutationObserverDOM.stop()] Aspis [MutationObserverDOM]: W\xE4chter gestoppt.");
  }
  async #handleMutations(mutations) {
    const addedNodes = [];
    const cleaner = this.registry?.get("cleaner");
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          cleaner?.cleanTree?.(node);
        }
      });
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          addedNodes.push(node);
        }
      });
    }
    if (addedNodes.length > 0 && typeof ScannerDOM !== "undefined" && typeof Main !== "undefined") {
      for (const rootNode of addedNodes) {
        const scanResults = ScannerDOM.scan(rootNode);
        if (scanResults.length > 0 && this.registry) {
          await Main.assignControllers(scanResults, this.registry);
          DebugAgent.info(`[MutationObserverDOM.#handleMutations()] Aspis [MutationObserverDOM]: ${scanResults.length} neue Controller im nachgeladenen DOM entdeckt und initialisiert.`);
        }
      }
    }
  }
  destroy() {
    this.stop();
    super.destroy();
  }
}
export {
  MutationObserverDOM
};
