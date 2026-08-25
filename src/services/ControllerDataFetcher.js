import { DebugAgent } from "../agents/DebugAgent.js";
import { RuntimeEnv } from "../core/RuntimeEnv.js";
class ControllerDataFetcher {
  #defaultTimeoutMs;
  constructor(defaultTimeoutMs = 8e3) {
    this.#defaultTimeoutMs = defaultTimeoutMs;
  }
  async request(url, options = {}) {
    const {
      params = {},
      signal = null,
      timeout = this.#defaultTimeoutMs,
      headers = {},
      method = "GET",
      body = null
    } = options;
    if (!url || typeof url !== "string") {
      throw new Error("ControllerDataFetcher: Keine g\xFCltige URL \xFCbergeben.");
    }
    const endpointUrl = new URL(url, RuntimeEnv.origin());
    Object.entries(params).forEach(([key, value]) => {
      if (value !== void 0 && value !== null) {
        endpointUrl.searchParams.append(key, String(value));
      }
    });
    const timeoutSignal = AbortSignal.timeout(timeout);
    let combinedSignal;
    if (!signal) {
      combinedSignal = timeoutSignal;
    } else if (typeof AbortSignal.any === "function") {
      combinedSignal = AbortSignal.any([signal, timeoutSignal]);
    } else {
      const combinedController = new AbortController();
      const onAbort = (source) => {
        if (!combinedController.signal.aborted) {
          combinedController.abort(source.reason);
        }
      };
      if (signal.aborted) {
        onAbort(signal);
      } else {
        signal.addEventListener("abort", () => onAbort(signal), { once: true });
      }
      if (timeoutSignal.aborted) {
        onAbort(timeoutSignal);
      } else {
        timeoutSignal.addEventListener("abort", () => onAbort(timeoutSignal), { once: true });
      }
      combinedSignal = combinedController.signal;
    }
    const requestHeaders = { ...headers };
    const fetchOptions = {
      method,
      headers: requestHeaders,
      signal: combinedSignal
    };
    if (body && method !== "GET") {
      if (typeof body === "object" && !(body instanceof FormData)) {
        requestHeaders["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(body);
      } else {
        fetchOptions.body = body;
      }
    }
    try {
      const response = await fetch(endpointUrl.toString(), fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP-Fehler: Status ${response.status} (${response.statusText})`);
      }
      if (response.status === 204) {
        return true;
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      const err = error;
      if (err.name === "TimeoutError") {
        DebugAgent.warn(`[ControllerDataFetcher.request()] Request auf '${url}' \xFCberschritt das Timeout von ${timeout}ms.`);
        return null;
      }
      if (err.name === "AbortError") {
        const reason = combinedSignal.reason || signal?.reason || "Abgebrochen";
        DebugAgent.info(`[ControllerDataFetcher.request()] Request auf '${url}' storniert -> Grund: ${reason}`);
        return null;
      }
      DebugAgent.error(`[ControllerDataFetcher.request()] Fehler bei ${method} ${url}:`, error);
      throw error;
    }
  }
  async get(url, params = {}, options = {}) {
    return this.request(url, { ...options, method: "GET", params });
  }
  async post(url, body = {}, options = {}) {
    return this.request(url, { ...options, method: "POST", body });
  }
  async put(url, body = {}, options = {}) {
    return this.request(url, { ...options, method: "PUT", body });
  }
  async delete(url, options = {}) {
    return this.request(url, { ...options, method: "DELETE" });
  }
}
export {
  ControllerDataFetcher
};
