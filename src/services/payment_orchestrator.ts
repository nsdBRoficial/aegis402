import { executeMppStandardPayment } from './mpp_standard_v2';
import { executeAegisNativePayment } from './aegis_v1_custom';

export interface PaymentOrchestratorConfig {
  agentSk: string;
  contractId: string;
  poolBalance: number;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

export async function orchestratePaymentFallback({
  agentSk,
  contractId,
  poolBalance,
  amount,
  log,
  onSuccess,
}: PaymentOrchestratorConfig): Promise<any> {
  if (poolBalance <= 0) {
    log('> ERROR 402: Insufficient funds in Shielded Pool. Deposit a minimum of 5 XLM to proceed.');
    return;
  }

  try {
    // Attempt Standard V2 (MPP SDK)
    log('> Initiating MPP Session (Standard V2)...');
    return await executeMppStandardPayment({
      agentSk,
      amount,
      log,
      onSuccess,
    });
  } catch (error: any) {
    const reason = error?.message ?? String(error);
    log(`> [STANDARD V2] Protocol handshake rejected by SDK. Transitioning to Aegis-Native (V1) Resiliency Layer...`);
    log(`> [DEBUG] V2 Failure Reason: ${reason}`);
    log('> 🛡️ Triggering Aegis-Native Redundancy (V1).');
    
    // Absolute fallback: Aegis-Native V1 (Custom Soroban)
    try {
      return await executeAegisNativePayment({
        agentSk,
        contractId,
        poolBalance,
        amount,
        log,
        onSuccess,
      });
    } catch (fallbackError: any) {
      log(`> ERROR: V1 Fallback also failed internally: ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}
