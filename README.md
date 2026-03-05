# Legal Transcriber — WhatsApp Audio AI Integration

> **Nota:** Este repositório serve como demonstração de arquitetura e portfólio técnico. O código-fonte integral é proprietário e não está disponível para distribuição pública.

Este projeto é uma extensão de alta performance para o Google Chrome (Manifest V3) desenvolvida como um **Software as a Service (SaaS)** para o setor jurídico. A ferramenta integra o motor de IA da **Groq Cloud (Whisper-large-v3)** ao **WhatsApp Web**, permitindo a transcrição instantânea de mensagens de voz.



---

## 🎯 Desafios Técnicos Superados

### 1. Injeção Dinâmica em Single Page Application (SPA)
O WhatsApp Web utiliza React, o que torna o DOM extremamente volátil. Implementei um sistema robusto com `MutationObserver` e `requestAnimationFrame` para garantir que a interface da extensão seja injetada em novos elementos de áudio sem causar "lag" ou vazamento de memória.

### 2. Latência e Performance de IA
Ao selecionar o modelo **Whisper-large-v3** via infraestrutura **Groq**, consegui reduzir o tempo de transcrição de áudios de 1 minuto para menos de 1.5 segundos, uma melhoria drástica em relação a implementações tradicionais.

### 3. Segurança e Sigilo Profissional
Sendo uma ferramenta para advogados, a privacidade foi o pilar central:
- **Zero Data Retention:** Os áudios são processados de forma efêmera.
- **Client-Side Security:** A API Key é gerida via `chrome.storage.local` com encriptação de sessão, nunca sendo exposta no código-fonte.

---

## 🛠️ Stack Tecnológica

- **Core:** JavaScript ES6+ (Vanilla), HTML5, CSS3.
- **Design:** Identidade visual premium nativa (Verde Escuro #1e7e5a & Dourado #c5a059) moldada especificamente para o setor jurídico e integrada de forma harmoniosa com o WhatsApp Web.
- **API:** Groq Cloud (Inference Engine).
- **Model:** OpenAI Whisper-large-v3-turbo.
- **Standard:** Manifest V3 (Google Chrome Extensions).

---

---

## 💼 Perfil Profissional

Desenvolvido por **João Paula**.  
Focado em soluções de automação e integração de Inteligência Artificial para otimização de fluxos de trabalho complexos.
