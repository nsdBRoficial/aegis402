/**
 * mpp_standard_v2.ts — Standard V2 Payment Execution via MPP SDK
 *
 * PT-BR: Usa o singleton global Mppx de mpp_client.ts.
 * O singleton DEVE ser inicializado via initMppClient() na montagem do App
 * ANTES desta função ser chamada — caso contrário o interceptor fetch
 * não estará ativo e o L402 challenge não será resolvido automaticamente.
 *
 * EN: Uses the Global Mppx singleton from mpp_client.ts.
 * The singleton MUST be initialized via initMppClient() at App mount
 * BEFORE this function is called — otherwise the fetch interceptor
 * won't be active and the 402 challenge will not be resolved.
 */

import { mppxClient } from './mpp_client';

// URL base da API — relativa para funcionar tanto no Vercel quanto em dev local com 'vercel dev'
// Base API URL — relative so it works on Vercel prod and local dev with 'vercel dev' alike
const API_BASE = '/api/data';

export interface MppStandardConfig {
  agentSk: string;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

/**
 * Modo Padrão (V2): Pagamento L402 automatizado via @stellar/mpp.
 * Standard Mode (V2): Automated L402 payment via @stellar/mpp.
 *
 * PT-BR: O invoice JSON (base64 em WWW-Authenticate) deve conter:
 * EN: Invoice JSON (base64 in WWW-Authenticate) must contain:
 *   { amount: "<stroops>", asset: "<SAC contract>", recipient: "<G...>", network: "testnet" }
 *
 * PT-BR: O interceptor Mppx faz patch do fetch global e liquida o 402 automaticamente.
 * EN: The Mppx interceptor patches global fetch and auto-settles the 402 challenge.
 */
export async function executeMppStandardPayment({
  agentSk,
  amount,
  log,
  onSuccess
}: MppStandardConfig): Promise<any> {

  // Guarda: confirma que o interceptor global está ativo
  // Guard: confirm the global interceptor is ready
  if (!mppxClient) {
    throw new Error('Mppx global client not initialized. Call initMppClient(sk) at app startup.');
  }

  // Debug: confirma que o método 'stellar' está registrado no interceptor
  // Debug: confirms the 'stellar' method is registered in the interceptor
  const registeredMethods = mppxClient?.methods ?? [];
  const methodNames = Array.isArray(registeredMethods)
    ? registeredMethods.map((m: any) => m?.name ?? m?.type ?? typeof m).join(', ')
    : 'unavailable';
  log(`> [DEBUG] Registered Methods: ${methodNames || 'stellar'}`);
  log(`> [MPP V2] Executing fetch — interceptor will auto-resolve L402...`);

  // Preflight: captura o header WWW-Authenticate bruto para diagnóstico
  // Preflight: captures raw WWW-Authenticate header for diagnostics
  let rawWwwAuth: string | null = null;
  try {
    // Chama a Vercel Serverless Function /api/data para preflight L402
    // Calls the Vercel Serverless Function /api/data for L402 preflight
    const preflight = await fetch(`${API_BASE}?amount=${amount}&preflight=1`, {
      headers: { 'X-Aegis-Preflight': 'true' }
    });
    rawWwwAuth = preflight.headers.get('www-authenticate');
    log(`> [DEBUG] Raw WWW-Authenticate: ${rawWwwAuth}`);

    // Decodifica o invoice para verificar os campos esperados pelo MPP SDK
    // Decodes the invoice to verify fields expected by the MPP SDK
    if (rawWwwAuth) {
      const invoiceMatch = rawWwwAuth.match(/invoice="([^"]+)"/);
      if (invoiceMatch?.[1]) {
        try {
          const decoded = JSON.parse(atob(invoiceMatch[1]));
          log(`> [DEBUG] Decoded invoice fields: ${Object.keys(decoded).join(', ')}`);
          log(`> [DEBUG] Invoice values → amount:${decoded.amount} asset:${decoded.asset?.slice(0,8)}... recipient:${decoded.recipient?.slice(0,6)}... network:${decoded.network}`);
        } catch (_) {
          log(`> [DEBUG] Invoice base64 (raw): ${invoiceMatch[1].slice(0, 50)}...`);
        }
      }
    }
  } catch (_) {
    log(`> [DEBUG] Preflight skipped — server may have blocked the preflight request.`);
  }

  try {
    // Fetch principal — interceptado pelo singleton Mppx global.
    // Main fetch — intercepted by the global Mppx singleton.
    // PT-BR: Se o servidor retornar 402 + header L402, o SDK liquida automaticamente.
    // EN: If the server returns 402 + L402 header, the SDK settles it automatically.
    const response = await fetch(`${API_BASE}?amount=${amount}`, {
      headers: {
        'Accept': 'application/json',
        // Identifica esta requisição como originada pelo protocolo MPP V2
        // Identifies this request as originating from the MPP V2 protocol
        'X-Aegis-Client': 'MPP-V2',
      }
    });

    if (!response.ok) {
      // Captura o header da resposta de falha para diagnóstico
      // Captures the header from the actual failing response for diagnostics
      const failHeader = response.headers.get('www-authenticate');
      log(`> [DEBUG] Raw WWW-Authenticate: ${failHeader}`);
      throw new Error(`HTTP ${response.status} — L402 challenge was NOT resolved by the interceptor.`);
    }

    const data = await response.json();
    await onSuccess(data);
    log('> 🟢 [MPP SDK] SUCCESS: Payment via Standard V2');
    return data.data;

  } catch (sdkError: any) {
    // Expõe a razão exata para o orquestrador decidir pelo fallback V1
    // Surfaces the exact reason so the orchestrator can decide on V1 fallback
    const reason = sdkError?.message ?? String(sdkError);
    log(`> [DEBUG] MPP V2 internal failure. Exact reason: ${reason}`);
    throw sdkError; // orquestrador capturará e ativará o V1 / orchestrator will catch this and trigger V1
  }
}
