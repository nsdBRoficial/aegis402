import { Keypair } from '@stellar/stellar-sdk';
import { Mppx, stellar } from '@stellar/mpp/charge/client';

export interface MppStandardConfig {
  agentSk: string;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

// Singleton reset per session — important so a fresh secretKey is applied each call
let mppxInstance: any = null;
let lastAgentSk: string = '';

/**
 * Standard Mode (V2): Official @stellar/mpp automated L402 flow.
 * Mppx intercepts fetch calls that return HTTP 402 + WWW-Authenticate: L402
 * and autonomously settles the invoice on-chain via Stellar.
 *
 * The payment scheme requires the server invoice to contain:
 *   { method: "stellar", intent: "charge", asset: "<Contract ID>", network: "stellar:testnet" }
 */
export async function executeMppStandardPayment({
  agentSk,
  amount,
  log,
  onSuccess
}: MppStandardConfig): Promise<any> {
  log('> [MPP V2] Initializing Mppx client. Protocol: Charge/Client...');

  // Recreate instance if secret key changes (e.g. different agent)
  if (!mppxInstance || lastAgentSk !== agentSk) {
    lastAgentSk = agentSk;
    mppxInstance = Mppx.create({
      methods: [
        stellar.charge({
          secretKey: agentSk,
          // Note: network is resolved from the server invoice (stellar:testnet in errorPayload)
          // Passing it here causes a TypeScript error — the SDK reads it from the L402 header
          onProgress: (event: any) => {
            const eventName = typeof event === 'string' ? event : (event.type ?? 'unknown');
            log(`> [MPP V2] Progress: ${eventName}`);
            if (event.hash) {
              log(`> Transaction Hash: ${event.hash}`);
            }
          }
        }),
      ],
    });
    log('> [MPP V2] Mppx instance created. Attaching fetch interceptor...');
  }

  // Wrap in explicit try/catch to expose the exact SDK error before fallback
  try {
    log(`> [MPP V2] Sending GET http://localhost:3001/api/data?amount=${amount}`);

    // Mppx patches the global fetch to intercept 402 + L402 scheme automatically
    const response = await fetch(`http://localhost:3001/api/data?amount=${amount}`, {
      headers: {
        'Accept': 'application/json',
        'X-Aegis-Client': 'MPP-V2'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — MPP SDK did not resolve the L402 challenge.`);
    }

    const data = await response.json();
    await onSuccess(data);
    log('> 🟢 [MPP SDK] SUCCESS: Payment via Standard V2');
    return data.data;

  } catch (sdkError: any) {
    // Expose the EXACT reason so the orchestrator can log it precisely
    const reason = sdkError?.message ?? String(sdkError);
    log(`> [DEBUG] MPP V2 internal failure. Exact reason: ${reason}`);
    // Re-throw so payment_orchestrator catches it and triggers V1
    throw sdkError;
  }
}
