import { BaseObserver } from "./BaseObserver.js";
import { ScannerDOM } from "./ScannerDOM.js";
import { LoggerService } from "../services/LoggerService.js";

/**
 * Observer-Klasse des Aspis-Frameworks zur Überwachung von DOM-Mutationen
 * (Hinzufügen und Entfernen von DOM-Knoten) sowie zur automatischen Lifecycle-Steuerung von Controllern.
 * 
 * @public
 * @extends {BaseObserver}
 */
export class MutationObserverDOM extends BaseObserver {
    /**
     * Referenz auf die native `MutationObserver`-Instanz der Web-API.
     * @internal
     * @type {MutationObserver | null}
     */
    #nativeObserver = null;

    /**
     * Startet die Mutation-Beobachtung auf dem Ziel-Element.
     * 
     * @public
     * @param {ObserverTarget} [target=document.body] - Das zu überwachende DOM-Ziel-Element.
     * @param {ObserverConfig} [config={ childList: true, subtree: true }] - Konfiguration für den MutationObserver.
     * @returns {void}
     */
    start(target = document.body, config = { childList: true, subtree: true }) {
        if (this.isObserving) return;

        this.#nativeObserver = new MutationObserver((mutations) => this.#handleMutations(mutations));
        this.#nativeObserver.observe(target, config);

        super.start(target);
        LoggerService.info("[MutationObserverDOM.start()] Aspis [MutationObserverDOM]: Wächter aktiv.");
    }

    /**
     * Fügt ein weiteres Ziel-Element zur laufenden Mutation-Beobachtung hinzu.
     * 
     * @public
     * @param {ObserverTarget} target - Das hinzuzufügende DOM-Ziel-Element.
     * @param {ObserverConfig} [config={ childList: true, subtree: true }] - Konfiguration für den MutationObserver.
     * @returns {void}
     */
    observe(target, config = { childList: true, subtree: true }) {
        if (!(target instanceof Node)) return;
        super.observe(target);
        if (this.#nativeObserver) {
            this.#nativeObserver.observe(target, config);
        }
    }

    /**
     * Stoppt die globale Mutation-Beobachtung und trennt den nativen Observer.
     * 
     * @public
     * @override
     * @returns {void}
     */
    stop() {
        if (this.#nativeObserver) {
            this.#nativeObserver.disconnect();
            this.#nativeObserver = null;
        }
        super.stop();
        LoggerService.info("[MutationObserverDOM.stop()] Aspis [MutationObserverDOM]: Wächter gestoppt.");
    }

    /**
     * Verarbeitet auftretende DOM-Mutationen, führt automatische Aufräumarbeiten durch
     * und initialisiert nachgeladene Controller im DOM.
     * 
     * @internal
     * @param {MutationRecord[]} mutations - Array der vom Browser gelieferten MutationRecords.
     * @returns {Promise<void>}
     */
    async #handleMutations(mutations) {
        const addedNodes = [];
        const cleaner = this.registry?.get('cleaner');

        for (const mutation of mutations) {
            mutation.removedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    cleaner?.cleanTree(node);
                }
            });

            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    addedNodes.push(node);
                }
            });
        }

        if (addedNodes.length > 0 && typeof ScannerDOM !== 'undefined' && typeof Main !== 'undefined') {
            for (const rootNode of addedNodes) {
                const scanResults = ScannerDOM.scan(rootNode);
                if (scanResults.length > 0) {
                    await Main.assignControllers(scanResults, this.registry);
                    LoggerService.info(`[MutationObserverDOM.#handleMutations()] Aspis [MutationObserverDOM]: ${scanResults.length} neue Controller im nachgeladenen DOM entdeckt und initialisiert.`);
                }
            }
        }
    }

    /**
     * Zerstört die Observer-Instanz, stoppt alle Listeners und löst Referenzen auf.
     * 
     * @public
     * @override
     * @returns {void}
     */
    destroy() {
        this.stop();
        super.destroy();
    }
}

/**
 * Interface des Cleaner-Services zur Bereinigung von DOM-Bäumen.
 * @typedef {Object} CleanerService
 * @property {(node: HTMLElement) => void} cleanTree - Bereinigt Instanzen und Binding-Referenzen im übergebenen DOM-Baum.
 */
/**
 * Registry-Interface für Services und Manager im Aspis-Framework.
 * @typedef {Object} ObserverRegistry
 * @property {(key: string) => any} get - Holt eine registrierte Service-Instanz (z. B. 'cleaner').
 */
/**
 * Zulässiges Ziel-Element für Mutation-Beobachtungen.
 * @typedef {Node} ObserverTarget
 */
/**
 * Konfigurationsobjekt für den nativen MutationObserver der Web-API.
 * @typedef {MutationObserverInit} ObserverConfig
 */
/**
 * Repräsentiert das Ergebnis eines DOM-Scans.
 * @typedef {Object.<string, any>} ScanResult
 */