/**
 * mpp_standard_v2.ts — Standard V2 Payment Execution
 *
 * Uses the Global Mppx singleton from mpp_client.ts.
 * The singleton MUST be initialized via initMppClient() at App mount
 * BEFORE this function is called — otherwise the fetch interceptor
 * won't be active and the 402 challenge will not be resolved.
 */

import { mppxClient } from './mpp_client';

export interface MppStandardConfig {
  agentSk: string;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

/**
 * Standard Mode (V2): Automated L402 payment via @stellar/mpp.
 *
 * The Mppx interceptor (initialized globally at app load) patches global fetch.
 * When fetch() receives an HTTP 402 + WWW-Authenticate: L402 header, it:
 *   1. Parses the base64 invoice to extract amount, asset, network
 *   2. Signs a Stellar transaction with the registered agentSk
 *   3. Retries the original request with the L402 bearer token
 *
 * Server invoice must include: { method: "stellar", intent: "charge" }
 */
export async function executeMppStandardPayment({
  agentSk,
  amount,
  log,
  onSuccess
}: MppStandardConfig): Promise<any> {

  // Guard: confirm the global interceptor is ready
  if (!mppxClient) {
    throw new Error('Mppx global client not initialized. Call initMppClient(sk) at app startup.');
  }

  // Debug: log registered methods to confirm scheme resolution is possible
  const methods = mppxClient?.methods;
  const methodNames = Array.isArray(methods)
    ? methods.map((m: any) => m?.name ?? m?.type ?? typeof m).join(', ')
    : 'unavailable';
  log(`> [MPP V2] Interceptor ready. Registered methods: [${methodNames || 'stellar'}]`);
  log(`> [MPP V2] Executing fetch — interceptor will auto-resolve L402...`);

  try {
    // This fetch is intercepted by the global Mppx singleton.
    // If the server returns 402 + L402 header, the SDK settles it automatically.
    const response = await fetch(`http://localhost:3001/api/data?amount=${amount}`, {
      headers: {
        'Accept': 'application/json',
        'X-Aegis-Client': 'MPP-V2',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — L402 challenge was NOT resolved by the interceptor.`);
    }

    const data = await response.json();
    await onSuccess(data);
    log('> 🟢 [MPP SDK] SUCCESS: Payment via Standard V2');
    return data.data;

  } catch (sdkError: any) {
    // Surface the exact reason for QA / orchestrator debug log
    const reason = sdkError?.message ?? String(sdkError);
    log(`> [DEBUG] MPP V2 internal failure. Exact reason: ${reason}`);
    throw sdkError;  // orchestrator will catch this and trigger V1
  }
}
