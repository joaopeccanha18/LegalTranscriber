/**
 * Legal Transcriber – page-interceptor.js
 * Corre no contexto da PÁGINA (não no isolated world do content script).
 * Injectado via <script src="chrome-extension://..."> para contornar a CSP.
 *
 * Faz monkey-patch de URL.createObjectURL para capturar o blob de áudio
 * que o WhatsApp cria APÓS desencriptar a mensagem de voz.
 */
(function () {
    if (window.__legalTranscriberActive) return;
    window.__legalTranscriberActive = true;

    const MSG_SOURCE = 'legal-transcriber-page';

    // Serialize blob → base64 dataURL → postMessage para o content script
    function sendBlob(blob) {
        const reader = new FileReader();
        reader.onloadend = function () {
            window.postMessage({
                source: MSG_SOURCE,
                type: 'AUDIO_BLOB_DATA',
                dataURL: reader.result,
                mimeType: blob.type || 'audio/ogg',
                timestamp: Date.now()
            }, '*');
        };
        reader.readAsDataURL(blob);
    }

    // ── Patch 1: URL.createObjectURL ────────────────────────────────────
    // WhatsApp chama isto com o buffer de áudio já desencriptado
    const _origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
        const url = _origCreate(obj);
        if (obj instanceof Blob) {
            const t = obj.type || '';
            const isAudio = t.includes('audio') || t.includes('ogg') ||
                t.includes('mpeg') || t.includes('mp4') ||
                t.includes('webm') || t.includes('opus');
            // Blobs grandes sem tipo declarado também podem ser áudio
            const unknownLarge = (t === '' && obj.size > 8000);
            if (isAudio || unknownLarge) {
                sendBlob(obj);
            }
        }
        return url;
    };

    // ── Patch 2: HTMLMediaElement.src setter ────────────────────────────
    // Caso o WA crie um <audio> e defina .src = "blob:..."
    const _srcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (_srcDesc && _srcDesc.set) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            set: function (val) {
                if (this instanceof HTMLAudioElement && val && val.startsWith('blob:')) {
                    fetch(val).then(r => r.blob()).then(b => sendBlob(b)).catch(() => { });
                }
                _srcDesc.set.call(this, val);
            },
            get: _srcDesc.get,
            configurable: true
        });
    }

    console.log('[Legal Transcriber] Page interceptor activo.');
})();
