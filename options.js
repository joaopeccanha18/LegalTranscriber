'use strict';

/**
 * Legal Transcriber – options.js
 * Script simplificado para o painel de status e guia.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Obter dinamicamente a versão atual definida no manifest.json
    const manifestData = chrome.runtime.getManifest();
    const versionDisplay = document.getElementById('versionDisplay');

    if (versionDisplay && manifestData && manifestData.version) {
        versionDisplay.textContent = `v${manifestData.version}`;
    }

    console.log('[Legal Transcriber] Painel de Status carregado com sucesso.');
});
