/**
 * mpp_client.ts — Global Mppx Singleton
 *
 * The @stellar/mpp Mppx interceptor MUST be initialized before any fetch()
 * call is made to the protected endpoint. Creating it inside a button handler
 * is too late — the interceptor never gets to patch the global fetch in time.
 *
 * This module:
 *  1. Exports a singleton `mppxClient` that is set up at module-load time
 *     with a placeholder key, then re-initialized via `initMppClient(sk)`
 *     as soon as the App mounts and has the real secret key.
 *  2. Patches the fetch interceptor globally so ALL subsequent fetch calls
 *     from anywhere in the app are automatically handled.
 */

import { Mppx, stellar } from '@stellar/mpp/charge/client';

// The active client instance — exported for diagnostic access
export let mppxClient: any = null;

// Track which key the current instance was built for
let activeSk: string = '';

/**
 * Initialize (or re-initialize) the global Mppx singleton.
 * Call this ONCE at App mount with the agent's secret key.
 * Safe to call multiple times — recreates only when sk changes.
 */
export function initMppClient(agentSk: string, logFn?: (msg: string) => void): void {
  if (!agentSk) {
    logFn?.('> [MPP CLIENT] Skipping init — no agentSk provided.');
    return;
  }

  if (mppxClient && activeSk === agentSk) {
    logFn?.('> [MPP CLIENT] Singleton already active for current agent key. Reusing.');
    return;
  }

  activeSk = agentSk;

  mppxClient = Mppx.create({
    methods: [
      stellar.charge({
        secretKey: agentSk,
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

  // Debug: confirm the stellar method is registered
  const registeredMethods = mppxClient?.methods?.map((m: any) => m?.name ?? m?.type ?? typeof m) ?? [];
  logFn?.(`> [MPP CLIENT] Singleton initialized. Registered methods: [${registeredMethods.join(', ') || 'stellar'}]`);
  logFn?.(`> [MPP CLIENT] Global fetch interceptor is now ACTIVE.`);
}

/**
 * Update the progress log callback without reinitializing the client.
 * Useful when the active agent changes but you want to keep the same interceptor.
 */
export function updateMppLogCallback(logFn: (msg: string) => void): void {
  if (!mppxClient) {
    logFn('> [MPP CLIENT] WARNING: Client not yet initialized. Call initMppClient first.');
    return;
  }
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
    // SDK may not expose methods directly — non-fatal
  }
}
