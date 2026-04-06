import { executeMppStandardPayment } from './mpp_standard_v2';
import { executeAegisNativePayment } from './aegis_v1_custom';

// Interfaces de configuração do Orchestrator / Orchestrator configuration interfaces
export interface PaymentOrchestratorConfig {
  agentSk: string;
  contractId: string;
  poolBalance: number;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

/**
 * PT-BR: Orchestrador de pagamento com fallback automático V2 → V1.
 * Tenta primeiro o protocolo padrão MPP (V2). Se falhar, ativa automaticamente
 * a camada de redundância Aegis-Native (V1) com contrato Soroban customizado.
 *
 * EN: Payment orchestrator with automatic V2 → V1 fallback.
 * Attempts the standard MPP protocol (V2) first. On failure, automatically activates
 * the Aegis-Native (V1) redundancy layer using a custom Soroban contract.
 *
 * Chama o contrato Soroban / Invokes the Soroban contract (via V1 fallback)
 */
export async function orchestratePaymentFallback({
  agentSk,
  contractId,
  poolBalance,
  amount,
  log,
  onSuccess,
}: PaymentOrchestratorConfig): Promise<any> {
  // Verifica saldo mínimo no pool antes de qualquer tentativa de pagamento
  // Verifies minimum pool balance before any payment attempt
  if (poolBalance <= 0) {
    log('> ERROR 402: Insufficient funds in Shielded Pool. Deposit a minimum of 5 XLM to proceed.');
    return;
  }

  try {
    // Tentativa V2: Protocolo MPP padrão (SDK Stellar MPP)
    // V2 Attempt: Standard MPP Protocol (Stellar MPP SDK)
    log('> Initiating MPP Session (Standard V2)...');
    return await executeMppStandardPayment({
      agentSk,
      amount,
      log,
      onSuccess,
    });
  } catch (error: any) {
    const reason = error?.message ?? String(error);

    // Falha no Handshake V2 → Ativando Redundância V1
    // V2 Handshake Failure → Activating V1 Redundancy Layer
    log(`> ⚠️ V2 Handshake Failure → Activating V1 Redundancy Layer.`);
    log(`> [DEBUG] V2 Failure Reason: ${reason}`);
    log('> Redundancy Layer Triggered. Switching to Aegis-Native (V1) Soroban contract.');
    
    // Fallback absoluto: Aegis-Native V1 (contrato Soroban customizado)
    // Absolute fallback: Aegis-Native V1 (custom Soroban contract)
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
      // Ambas as camadas falharam — erro crítico de gateway
      // Both layers failed — critical gateway error
      log(`> ERROR: V1 Fallback also failed internally: ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}
