/** @typedef {import("../../types/store.js").Store} Store */
import { DebugAgent } from "../../agents/DebugAgent.js";
import { StoreEffects } from "./StoreEffects.js";
class StoreFlush {
  static hasPendingDom(store) {
    return store.runtime.pendingDomUpdates.size > 0;
  }
  static schedule(store) {
    const runtime = store.runtime;
    if (runtime.isFlushPending) return;
    runtime.isFlushPending = true;
    if (typeof requestAnimationFrame !== "undefined") {
      runtime.flushTimerId = requestAnimationFrame(() => {
        runtime.flushTimerId = null;
        this.run(store);
      });
    } else {
      queueMicrotask(() => this.run(store));
    }
  }
  static flushNow(store) {
    const runtime = store.runtime;
    if (!runtime.isFlushPending) return;
    if (runtime.flushTimerId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(runtime.flushTimerId);
      runtime.flushTimerId = null;
    }
    this.run(store);
  }
  static run(store) {
    const runtime = store.runtime;
    try {
      if (runtime.pendingDomUpdates.size > 0) {
        runtime.pendingDomUpdates.forEach((paths, element) => {
          this.dispatchElementUpdate(element, paths);
        });
      }
      StoreEffects.runQueue(store);
    } catch (error) {
      DebugAgent.error("[StoreFlush.run()] Aspis [Store]: Fehler w\xE4hrend des Queue-Flushes:", error);
    } finally {
      runtime.pendingDomUpdates.clear();
      StoreEffects.clearQueue(store);
      runtime.isFlushPending = false;
      runtime.flushTimerId = null;
    }
  }
  static dispatchElementUpdate(element, triggeredPaths) {
    const pathArray = Array.from(triggeredPaths);
    element.dispatchEvent(
      new CustomEvent("aspis:data-mutation", {
        bubbles: true,
        detail: {
          path: pathArray.length === 1 ? pathArray[0] : pathArray,
          paths: pathArray,
          dependsOn: element.dataset.dependsOn
        }
      })
    );
  }
}
export {
  StoreFlush
};
