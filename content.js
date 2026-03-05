/**
 * Legal Transcriber – content.js
 * @version 1.4.0
 *
 * Injeta page-interceptor.js (via <script src>) para capturar
 * o blob de áudio do WhatsApp, depois envia à API Groq.
 */

'use strict';

// ─── Configuração ─────────────────────────────────────────────────────
const GROQ_API_KEY = 'COLE_AQUI_A_SUA_CHAVE_GSK';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';
const INJECTED_ATTR = 'data-legal-injected';
const MSG_SOURCE = 'legal-transcriber-page';

const DEBUG = true;
function log(...args) { if (DEBUG) console.log('[Legal Transcriber]', ...args); }

// Botões de play de mensagens de voz do WhatsApp (PT + EN)
const PLAY_BTN_SELECTOR = [
  'button[aria-label*="voz"]',
  'button[aria-label*="voice"]',
  'button[aria-label*="Voice"]',
  'button[aria-label*="audio"]',
  'button[aria-label*="Audio"]',
  'button[aria-label*="Reproduzir"]',
].join(', ');

// ─────────────────────────────────────────────────────────────────────
// 1. INJECTAR page-interceptor.js NA PÁGINA
//    Via <script src="chrome-extension://..."> — passa a CSP do WA.
//    Deve acontecer o mais cedo possível (run_at: document_start).
// ─────────────────────────────────────────────────────────────────────

function injectPageInterceptor() {
  if (document.getElementById('legal-transcriber-interceptor')) return;
  const script = document.createElement('script');
  script.id = 'legal-transcriber-interceptor';
  script.src = chrome.runtime.getURL('page-interceptor.js');
  script.onload = () => { log('page-interceptor.js carregado com sucesso.'); script.remove(); };
  script.onerror = () => log('ERRO ao carregar page-interceptor.js!');
  (document.head || document.documentElement).prepend(script);
}

// ─────────────────────────────────────────────────────────────────────
// 2. ESCUTAR MENSAGENS DO INTERCEPTOR
// ─────────────────────────────────────────────────────────────────────

let _lastCapture = null; // { dataURL, mimeType, timestamp }

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data || e.data.source !== MSG_SOURCE) return;
  if (e.data.type === 'AUDIO_BLOB_DATA') {
    _lastCapture = { dataURL: e.data.dataURL, mimeType: e.data.mimeType, timestamp: e.data.timestamp };
    log('Blob recebido:', e.data.mimeType, Math.round(e.data.dataURL.length / 1024) + ' KB');
  }
});

// ─────────────────────────────────────────────────────────────────────
// 3. AGUARDAR BLOB APÓS CLICAR EM PLAY
// ─────────────────────────────────────────────────────────────────────

function dataURLtoBlob(dataURL, mime) {
  const [header, b64] = dataURL.split(',');
  const type = mime || (header.match(/:(.*?);/) || [])[1] || 'audio/ogg';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}

function waitForBlob(afterTs, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(
        'O WhatsApp não carregou o blob de áudio a tempo.\n' +
        'Clica em Play uma vez, aguarda um segundo e tenta de novo.'
      ));
    }, timeout);

    function handler(e) {
      if (e.source !== window) return;
      if (!e.data || e.data.source !== MSG_SOURCE) return;
      if (e.data.type === 'AUDIO_BLOB_DATA' && e.data.timestamp >= afterTs) {
        clearTimeout(deadline);
        window.removeEventListener('message', handler);
        resolve(e.data);
      }
    }
    window.addEventListener('message', handler);
  });
}

async function resolveAudioBlob(playBtn) {
  const start = Date.now();
  log('A iniciar captura. A clicar em Play...');

  // Iniciar escuta ANTES de clicar
  const blobPromise = waitForBlob(start, 6000);
  playBtn.click();

  const data = await blobPromise;

  // Pausar imediatamente para não perturbar
  try { const a = document.querySelector('audio'); if (a) { a.pause(); a.currentTime = 0; } } catch (_) { }

  return dataURLtoBlob(data.dataURL, data.mimeType);
}

// ─────────────────────────────────────────────────────────────────────
// 4. API GROQ
// ─────────────────────────────────────────────────────────────────────

async function transcribeWithGroq(blob) {
  if (!GROQ_API_KEY || GROQ_API_KEY === 'COLE_AQUI_A_SUA_CHAVE_GSK') {
    throw new Error('API Key não configurada. Edita a constante GROQ_API_KEY no content.js.');
  }

  const t = blob.type || 'audio/ogg';
  const ext = t.includes('mp4') ? 'mp4' : t.includes('mp3') || t.includes('mpeg') ? 'mp3'
    : t.includes('webm') ? 'webm' : 'ogg';

  const form = new FormData();
  form.append('file', blob, `audio.${ext}`);
  form.append('model', GROQ_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  // Foi removido o 'prompt' para o Whisper parar de transcrever "Contexto jurídico..."
  form.append('temperature', '0');       // ← determinístico = mais preciso

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    let msg = `Groq API erro HTTP ${res.status}`;
    try { msg = (await res.json())?.error?.message || msg; } catch (_) { }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data?.text) throw new Error('Groq não retornou texto.');
  return data.text.trim();
}

// ─────────────────────────────────────────────────────────────────────
// 5. DOM — Botão + Balão
// ─────────────────────────────────────────────────────────────────────

function createBtn() {
  const b = document.createElement('button');
  b.className = 'legal-transcriber-btn';
  b.type = 'button';
  b.textContent = 'Aa';
  b.title = 'Transcrever áudio (Legal Transcriber)';
  b.setAttribute('aria-label', 'Transcrever mensagem de áudio');
  return b;
}

function renderBubble(anchor, text, isError = false) {
  let bubble = anchor.nextElementSibling;
  if (!bubble || !bubble.classList.contains('legal-transcriber-bubble')) {
    bubble = document.createElement('div');
    bubble.className = 'legal-transcriber-bubble';
    anchor.insertAdjacentElement('afterend', bubble);
  }
  bubble.classList.toggle('legal-bubble-error', isError);

  // Limpar conteúdo anterior para inserir texto em bloco + botão (se não for erro)
  bubble.innerHTML = '';

  const textDiv = document.createElement('div');
  textDiv.className = 'legal-transcriber-text';
  textDiv.textContent = text;
  bubble.appendChild(textDiv);

  if (!isError) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'legal-copy-btn';
    copyBtn.textContent = 'Copiar Texto';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(text);
        const origText = copyBtn.textContent;
        copyBtn.textContent = 'Copiado! ✓';
        setTimeout(() => { copyBtn.textContent = origText; }, 2000);
      } catch (err) {
        console.error('[Legal Transcriber] Falha ao copiar texto:', err);
      }
    });
    bubble.appendChild(copyBtn);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. INJECÇÃO DO BOTÃO
// ─────────────────────────────────────────────────────────────────────

function findRoot(playBtn) {
  let el = playBtn.parentElement;
  for (let i = 0; i < 7; i++) {
    if (!el) break;
    if (el.getBoundingClientRect().width > 150) return el;
    el = el.parentElement;
  }
  return playBtn.parentElement || playBtn;
}

function injectButton(playBtn) {
  // Ignorar se já injetámos neste botão específico
  if (!playBtn || playBtn.getAttribute(INJECTED_ATTR)) return;
  playBtn.setAttribute(INJECTED_ATTR, 'true');

  const root = findRoot(playBtn);

  // ── PREVENÇÃO DE DUPLICADOS NO MESMO PLAYER ──
  // Às vezes o WA tem 2 botões sobrepostos com o mesmo aria-label.
  // Prevenimos injetar dois "Aa" no mesmo playerRoot.
  if (root.querySelector('.legal-transcriber-btn') ||
    root.parentElement?.querySelector('.legal-transcriber-btn')) {
    log('Player já tem botão Aa. Ignorando botão fantasma.');
    return;
  }

  const btn = createBtn();
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await handleTranscription(btn, playBtn, root);
  });

  // ── POSICIONAMENTO CORRIGIDO ──
  // Inserir o botão imediatamente ANTES do contentor do botão de Play,
  // dentro do contentor Flex horizontal do WhatsApp, para que fiquem lado-a-lado
  // em vez de empilhados verticalmente acima do player.
  try {
    const playBtnContainer = playBtn.parentElement;
    if (playBtnContainer && playBtnContainer.parentElement) {
      // Garantir que o contentor pai mantém alinhamento horizontal (row)
      playBtnContainer.parentElement.style.display = 'flex';
      playBtnContainer.parentElement.style.flexDirection = 'row';
      playBtnContainer.parentElement.style.alignItems = 'center';

      playBtnContainer.parentElement.insertBefore(btn, playBtnContainer);
    } else {
      root.parentElement.insertBefore(btn, root);
    }
  } catch (err) {
    log('Erro ao inserir botão:', err);
  }
}

async function handleTranscription(btn, playBtn, root) {
  if (btn.classList.contains('legal-loading')) return;
  const orig = btn.textContent;
  btn.textContent = '...';
  btn.classList.add('legal-loading');
  btn.disabled = true;

  [btn.nextElementSibling, root.nextElementSibling].forEach(el => {
    if (el?.classList.contains('legal-transcriber-bubble')) el.remove();
  });

  try {
    const blob = await resolveAudioBlob(playBtn);
    log('Blob pronto:', blob.type, blob.size, 'bytes. A enviar à Groq...');
    const text = await transcribeWithGroq(blob);

    renderBubble(root, text, false);
    btn.textContent = '✓';
    btn.classList.remove('legal-loading', 'legal-error');
    btn.disabled = false;
    setTimeout(() => { btn.textContent = orig; }, 3000);

  } catch (err) {
    console.error('[Legal Transcriber]', err);
    renderBubble(root, err.message || 'Erro inesperado.', true);
    btn.textContent = '!';
    btn.classList.replace('legal-loading', 'legal-error');
    btn.disabled = false;
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('legal-error'); }, 8000);
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. SCAN + OBSERVER
// ─────────────────────────────────────────────────────────────────────

function scanAndInject() {
  const sel = PLAY_BTN_SELECTOR.split(', ')
    .map(s => `${s}:not([${INJECTED_ATTR}])`)
    .join(', ');
  const btns = document.querySelectorAll(sel);

  if (btns.length) {
    let injectedCount = 0;
    btns.forEach(btn => {
      // ── FILTRO RIGOROSO ──
      // 1. Ignorar qualquer botão que esteja no rodapé/composer (zona de escrever novas mensagens)
      if (btn.closest('footer') || btn.closest('#main footer')) {
        btn.setAttribute(INJECTED_ATTR, 'ignored'); // Marcar para não processar mais
        return;
      }

      // 2. Ignorar o botão de gravar áudio (microfone)
      const lbl = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
      if (lbl === 'mensagem de voz' || lbl === 'voice message' || lbl === 'abrir painel de emojis') {
        btn.setAttribute(INJECTED_ATTR, 'ignored');
        return;
      }

      injectButton(btn);
      injectedCount++;
    });

    if (injectedCount > 0) {
      log(`${injectedCount} botão(ões) de transcrição injectado(s).`);
    }
  }
}

let pending = false;
const observer = new MutationObserver(() => {
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; scanAndInject(); }, 400);
});

// ─────────────────────────────────────────────────────────────────────
// 8. INIT (run_at: document_start → injectar interceptor antes do WA)
// ─────────────────────────────────────────────────────────────────────

injectPageInterceptor(); // ← sempre primeiro, antes de tudo

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log('v1.4.0 pronto.');
    scanAndInject();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  log('v1.4.0 pronto (DOM já carregado).');
  scanAndInject();
  observer.observe(document.body, { childList: true, subtree: true });
}
