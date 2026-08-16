/**
 * Unterstützte HTTP-Methoden für Anfragen im Aspis-Framework.
 * @typedef {'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD'} HttpMethod
 */
/**
 * Key-Value-Map für URL-Query-Parameter.
 * @typedef {Record<string, string | number | boolean | null | undefined>} HttpParams
 */
/**
 * Key-Value-Map für HTTP-Header.
 * @typedef {Record<string, string>} HttpHeaders
 */
/**
 * Mitzusendender Payload-Datentyp für HTTP-Requests.
 * @typedef {Record<string, any> | FormData | string | Blob | ArrayBuffer | null} HttpBody
 */
/**
 * Möglicher Rückgabetyp einer DatenFetcher-Anfrage.
 * @template T
 * @typedef {T | boolean | string | null} FetchResult
 */
/**
 * Konfigurationsoptionen für die generische `request()`-Methode.
 * @typedef {Object} RequestOptions
 * @property {HttpParams} [params={}] - Query-Parameter für die URL.
 * @property {AbortSignal|null} [signal=null] - Optionales AbortSignal zum manuellen Stornieren.
 * @property {number} [timeout] - Timeout in Millisekunden.
 * @property {HttpHeaders} [headers={}] - Zusätzliche HTTP-Header.
 * @property {HttpMethod} [method='GET'] - Die zu verwendende HTTP-Methode.
 * @property {HttpBody} [body=null] - Der mitzusendende Request-Body.
 */
/**
 * Optionseinstellungen für spezifische HTTP-Methoden (`get`, `post`, `put`, `delete`).
 * @typedef {Object} HttpOptions
 * @property {HttpParams} [params] - Query-Parameter für die URL.
 * @property {AbortSignal|null} [signal] - Optionales AbortSignal zum Stornieren.
 * @property {number} [timeout] - Timeout in Millisekunden.
 * @property {HttpHeaders} [headers] - Zusätzliche HTTP-Header.
 * @property {HttpBody} [body] - Request-Body.
 */

/**
 * Service-Klasse des Aspis-Frameworks für asynchrone HTTP-Requests.
 * Bietet integrierte Timeout-Steuerung, automatische Signal-Kombination (AbortSignal) sowie
 * automatisches Parsing von JSON/Text-Antworten und Fehlerbehandlung.
 * 
 * @public
 */
export class DatenFetcher {
    /**
     * Standard-Timeout in Millisekunden für alle Anfragen.
     * @internal
     * @type {number}
     */
    #defaultTimeoutMs;

    /**
     * Erzeugt eine neue Instanz des DatenFetchers.
     * 
     * @public
     * @param {number} [defaultTimeoutMs=8000] - Standard-Timeout für HTTP-Anfragen in Millisekunden.
     */
    constructor(defaultTimeoutMs = 8000) {
        this.#defaultTimeoutMs = defaultTimeoutMs;
    }

    /**
     * Führt einen konfigurierbaren HTTP-Request aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL der HTTP-Anfrage.
     * @param {RequestOptions} [options={}] - Konfigurationsoptionen für die Anfrage.
     * @returns {Promise<FetchResult<T>>} Die geparsten Daten, `true` bei Status 204 (No Content), oder `null` bei Timeout/Abbruch.
     * @throws {Error} Wenn die übergebene URL ungültig ist oder ein HTTP-Fehlerstatus auftritt.
     */
    async request(url, { params = {}, signal = null, timeout = this.#defaultTimeoutMs, headers = {}, method = 'GET', body = null } = {}) {
        if (!url || typeof url !== 'string') {
            throw new Error("DatenFetcher: Keine gültige URL übergeben.");
        }

        const endpointUrl = new URL(url, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                endpointUrl.searchParams.append(key, value);
            }
        });

        const timeoutSignal = AbortSignal.timeout(timeout);

        let combinedSignal;

        if (!signal) {
            combinedSignal = timeoutSignal;
        } else if (typeof AbortSignal.any === 'function') {
            combinedSignal = AbortSignal.any([signal, timeoutSignal]);
        } else {
            const combinedController = new AbortController();

            const onAbort = (s) => {
                if (!combinedController.signal.aborted) {
                    combinedController.abort(s.reason);
                }
            };

            if (signal.aborted) {
                onAbort(signal);
            } else {
                signal.addEventListener('abort', () => onAbort(signal), { once: true });
            }

            if (timeoutSignal.aborted) {
                onAbort(timeoutSignal);
            } else {
                timeoutSignal.addEventListener('abort', () => onAbort(timeoutSignal), { once: true });
            }

            combinedSignal = combinedController.signal;
        }

        const fetchOptions = {
            method,
            headers: { ...headers },
            signal: combinedSignal
        };

        if (body && method !== 'GET') {
            if (typeof body === 'object' && !(body instanceof FormData)) {
                fetchOptions.headers['Content-Type'] = 'application/json';
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

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {
            if (error.name === 'TimeoutError') {
                LoggerService.warn(`[DatenFetcher.request()] Aspis [DatenFetcher]: Request auf '${url}' überschritt das Timeout von ${timeout}ms.`);
                return null;
            }

            if (error.name === 'AbortError') {
                const reason = combinedSignal.reason || signal?.reason || 'Abgebrochen';
                LoggerService.info(`[DatenFetcher.request()] Aspis [DatenFetcher]: Request auf '${url}' storniert -> Grund: ${reason}`);
                return null; 
            }

            LoggerService.error(`[DatenFetcher.request()] Aspis [DatenFetcher]: Fehler bei ${method} ${url}:`, error);
            throw error;
        }
    }

    /**
     * Führt eine HTTP-GET-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpParams} [params={}] - URL-Query-Parameter.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async get(url, params = {}, options = {}) {
        return this.request(url, { ...options, method: 'GET', params });
    }

    /**
     * Führt eine HTTP-POST-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpBody} [body={}] - Der im Body zu übertragende Dateninhalt.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async post(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    /**
     * Führt eine HTTP-PUT-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpBody} [body={}] - Der im Body zu übertragende Dateninhalt.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async put(url, body = {}, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    /**
     * Führt eine HTTP-DELETE-Anfrage aus.
     * 
     * @public
     * @async
     * @template T
     * @param {string} url - Die Ziel-URL.
     * @param {HttpOptions} [options={}] - Zusätzliche Request-Optionen.
     * @returns {Promise<FetchResult<T>>} Die Antwortdaten oder `null` bei Abbruch/Timeout.
     * @throws {Error} Wenn ein HTTP-Fehler auftritt.
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}