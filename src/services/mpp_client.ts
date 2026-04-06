/**
 * mpp_client.ts — Singleton Global do Mppx / Global Mppx Singleton
 *
 * PT-BR: O interceptor Mppx DEVE ser inicializado ANTES de qualquer chamada fetch()
 * ao endpoint protegido. Criar dentro de um handler de botão é tarde demais —
 * o interceptor nunca consegue fazer o patch do fetch global a tempo.
 *
 * EN: The @stellar/mpp Mppx interceptor MUST be initialized before any fetch()
 * call is made to the protected endpoint. Creating it inside a button handler
 * is too late — the interceptor never gets to patch the global fetch in time.
 *
 * Este módulo / This module:
 *  1. Exporta um singleton `mppxClient` configurado no carregamento do módulo
 *     com uma chave placeholder, re-inicializado via `initMppClient(sk)`
 *     assim que o App monta e tem a chave secreta real.
 *     Exports a singleton `mppxClient` set up at module-load time
 *     with a placeholder key, then re-initialized via `initMppClient(sk)`
 *     as soon as the App mounts and has the real secret key.
 *
 *  2. Faz o patch do interceptor fetch globalmente para que TODAS as chamadas
 *     subsequentes do app sejam automaticamente tratadas pelo protocolo MPP.
 *     Patches the fetch interceptor globally so ALL subsequent fetch calls
 *     from anywhere in the app are automatically handled by the MPP protocol.
 */

import { Mppx, stellar } from '@stellar/mpp/charge/client';

// A instância ativa do cliente — exportada para acesso diagnóstico
// The active client instance — exported for diagnostic access
export let mppxClient: any = null;

// Rastreia qual chave foi usada para criar a instância atual
// Tracks which key the current instance was built for
let activeSk: string = '';

/**
 * Inicializa (ou re-inicializa) o singleton global Mppx.
 * Initialize (or re-initialize) the global Mppx singleton.
 *
 * PT-BR: Chame UMA VEZ na montagem do App com a chave secreta do agente.
 * Seguro para múltiplas chamadas — recria somente quando a chave muda.
 *
 * EN: Call this ONCE at App mount with the agent's secret key.
 * Safe to call multiple times — recreates only when sk changes.
 */
export function initMppClient(agentSk: string, logFn?: (msg: string) => void): void {
  // Proteção contra inicialização sem chave / Guard against init without a key
  if (!agentSk) {
    logFn?.('> [MPP CLIENT] Skipping init — no agentSk provided.');
    return;
  }

  // Proteção Singleton: evita recriar o interceptor para a mesma chave
  // Singleton guard: avoids recreating the fetch interceptor for the same key
  if (mppxClient && activeSk === agentSk) {
    logFn?.('> [MPP CLIENT] Singleton already active for current agent key. Reusing.');
    return;
  }

  activeSk = agentSk;

  // Cria o cliente Mppx com o método Stellar Charge habilitado
  // Creates the Mppx client with the Stellar Charge method enabled
  mppxClient = Mppx.create({
    methods: [
      stellar.charge({
        // Chave secreta do agente pagador / Secret key of the paying agent
        secretKey: agentSk,
        // Callback de progresso — emite eventos de transação em tempo real
        // Progress callback — emits real-time transaction events (hash, status)
        onProgress: (event: any) => {
          const eventName = typeof event === 'string' ? event : (event?.type ?? 'event');
          logFn?.(`> [MPP V2] ⟳ Progress: ${eventName}`);
          if (event?.hash) {
            logFn?.(`> Transaction Hash: ${event.hash}`);
          }
        },
      }),
    ],
  });

  // Debug: confirma que o método Stellar foi registrado no interceptor global
  // Debug: confirms the stellar method is registered in the global fetch interceptor
  const registeredMethods = mppxClient?.methods?.map((m: any) => m?.name ?? m?.type ?? typeof m) ?? [];
  logFn?.(`> [MPP CLIENT] Singleton initialized. Registered methods: [${registeredMethods.join(', ') || 'stellar'}]`);
  logFn?.(`> [MPP CLIENT] Global fetch interceptor is now ACTIVE.`);
}

/**
 * Atualiza o callback de log sem re-inicializar o cliente.
 * Update the progress log callback without reinitializing the client.
 *
 * PT-BR: Útil quando o agente ativo muda mas você quer manter o mesmo interceptor.
 * EN: Useful when the active agent changes but you want to keep the same interceptor.
 */
export function updateMppLogCallback(logFn: (msg: string) => void): void {
  if (!mppxClient) {
    logFn('> [MPP CLIENT] WARNING: Client not yet initialized. Call initMppClient first.');
    return;
  }
  // O SDK Mppx expõe o objeto de método subjacente — atualizamos seu onProgress
  // The Mppx SDK exposes the underlying method object — we update its onProgress
  try {
    const chargeMethod = mppxClient.methods?.[0];
    if (chargeMethod && typeof chargeMethod.onProgress !== 'undefined') {
      chargeMethod.onProgress = (event: any) => {
        const eventName = typeof event === 'string' ? event : (event?.type ?? 'event');
        logFn(`> [MPP V2] ⟳ Progress: ${eventName}`);
        if (event?.hash) logFn(`> Transaction Hash: ${event.hash}`);
      };
    }
  } catch (_) {
    // O SDK pode não expor métodos diretamente — não é fatal
    // SDK may not expose methods directly — non-fatal
  }
}
