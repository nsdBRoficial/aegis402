import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestratePaymentFallback } from '../services/payment_orchestrator';
import * as mppStandard from '../services/mpp_standard_v2';
import * as legacyCustom from '../services/aegis_v1_custom';

describe('Payment Orchestrator Resilience (Fallback V2 -> V1)', () => {
  const mockConfig = {
    agentSk: 'S_Mock_Agent_Secret',
    contractId: 'C_Mock_Contract_ID',
    poolBalance: 50,
    log: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve disparar executeAegisNativePayment (V1) caso executeMppStandardPayment (V2) retorne "Channel Timeout"', async () => {
    // Espiando e mockando as funções exatas para testar a ponte abstrata independentemente da UI React
    const mppSpy = vi.spyOn(mppStandard, 'executeMppStandardPayment').mockRejectedValue(new Error('Channel Timeout'));
    const fallbackSpy = vi.spyOn(legacyCustom, 'executeAegisNativePayment').mockResolvedValue(undefined);

    await orchestratePaymentFallback(mockConfig);

    expect(mppSpy).toHaveBeenCalledTimes(1);
    expect(fallbackSpy).toHaveBeenCalledTimes(1);

    // Avalia a resiliência transpondo a assinatura
    expect(mockConfig.log).toHaveBeenCalledWith(
      expect.stringContaining('[MPP SDK] Falha no fluxo Standard (Canal ou Provedor não suporta V2): Channel Timeout')
    );
    expect(mockConfig.log).toHaveBeenCalledWith(
      expect.stringContaining('Iniciando fallback automático para Aegis-Native (V1 Custom)')
    );
  });

  it('deve bloquear imediatamente execução se poolBalance for menor ou igual a 0', async () => {
    const configZeroPool = { ...mockConfig, poolBalance: 0 };
    
    const mppSpy = vi.spyOn(mppStandard, 'executeMppStandardPayment');
    const fallbackSpy = vi.spyOn(legacyCustom, 'executeAegisNativePayment');

    await orchestratePaymentFallback(configZeroPool);

    expect(mppSpy).not.toHaveBeenCalled();
    expect(fallbackSpy).not.toHaveBeenCalled();
    expect(mockConfig.log).toHaveBeenCalledWith(
      expect.stringContaining('ERROR 402: Insufficient funds in Shielded Pool')
    );
  });
});
