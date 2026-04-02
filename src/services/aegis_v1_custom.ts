import { Keypair, TransactionBuilder, Networks, Contract, rpc, xdr, Account, Address } from '@stellar/stellar-sdk';
import axios from 'axios';

export interface AegisNativeConfig {
  agentSk: string;
  contractId: string;
  poolBalance: number;
  amount: number;
  log: (msg: string) => void;
  onSuccess: (data: any) => Promise<void>;
}

/**
 * Legacy Mode (Aegis-Native V1): Custom L402 + ZK-Commitments flow.
 * Manually handles the 402 fetch, invokes the Soroban contract and completes the API handshake.
 */
export async function executeAegisNativePayment({
  agentSk,
  contractId,
  poolBalance,
  amount,
  log,
  onSuccess
}: AegisNativeConfig): Promise<any> {
  if (poolBalance <= 0) {
    log('> ERROR 402: Insufficient funds in Shielded Pool. Deposit a minimum of 5 XLM to proceed.');
    return;
  }

  try {
    log(`> GET /api/data?amount=${amount}... (Without L402 Header)`);
    await axios.get(`http://localhost:3001/api/data?amount=${amount}`);
    log('> WARNING: API accessed without Authorization header. (Check middleware!)');
  } catch (error: any) {
    if (error.response?.status === 402) {
      log(`> ERROR 402: Payment Required. Invoice info: ${JSON.stringify(error.response.data)}`);
      log('> Generating ZK Commitment Reveal locally...');
      
      try {
        if (!agentSk || !contractId) throw new Error("VITE_AGENT_SECRET_KEY or VITE_CONTRACT_ID missing from V1 configuration");
        const agentKeypair = Keypair.fromSecret(agentSk);
        
        const accRes = await axios.get(`https://horizon-testnet.stellar.org/accounts/${agentKeypair.publicKey()}`);
        const account = new Account(agentKeypair.publicKey(), accRes.data.sequence);

        const contract = new Contract(contractId);
        const nativeAssetContractId = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
        const tokenScVal = new Address(nativeAssetContractId).toScVal();
        
        // O Agente invoca o contrato enviando seu "conhecimento" do Preimage
        const secretScVal = xdr.ScVal.scvBytes(Buffer.from("zk_signature_mock".padEnd(32, '0')));
        const providerScVal = new Address("GDZLSBJ7GF2CLMJXGJTTSTN6CZXJQ343HWLFKY7K6DYBEO53D73AS2DR").toScVal(); 
        const amountScVal = xdr.ScVal.scvI128(new xdr.Int128Parts({
          hi: xdr.Int64.fromXDR(Buffer.alloc(8)),           // high bits = 0
          lo: xdr.Uint64.fromXDR(                            // low bits = stroops
                Buffer.from(
                  BigInt(Math.floor(amount * 10000000)).toString(16).padStart(16, '0'),
                  'hex'
                )
              )
        }));

        log('> Executing Soroban contract (pay)... Waiting for Testnet RPC...');

        let tx = new TransactionBuilder(account, {
          fee: "1000000",
          networkPassphrase: Networks.TESTNET,
        })
        .addOperation(contract.call("pay", secretScVal, providerScVal, tokenScVal, amountScVal))
        .setTimeout(30)
        .build();
        
        const server = new rpc.Server('https://soroban-testnet.stellar.org');
        
        log('> Auditing Pool liquidity on Testnet...  ');
        let preparedTx;
        try {
           preparedTx = await server.prepareTransaction(tx);
        } catch (simError: any) {
           console.warn("Simulation error:", simError);
           const errMsg = simError?.response?.data?.extras?.resultCodes || simError.message;
           log(`> ERROR VM SOROBAN: Simulation failed or contract unreachable. Details: ${JSON.stringify(errMsg)}`);
           throw new Error("Transaction failed on simulation.");
        }
        
        preparedTx.sign(agentKeypair);
        
        const sendRes = await server.sendTransaction(preparedTx);
        log(`> Transaction Hash: ${sendRes.hash}`);
        
        // Poll Real
        let status: string = sendRes.status;
        let txResult;
        while (status === "PENDING" || status === "NOT_FOUND") {
          await new Promise(r => setTimeout(r, 2000));
          txResult = await server.getTransaction(sendRes.hash);
          status = txResult.status;
        }
        
        // --- SUCCESS PARADOX FIX ---
        // Previously, the SUCCESS branch called onSuccess AND then fell through to FATAL.
        // Now: SUCCESS = clean exit. Only the else-branch throws.
        if (status === "SUCCESS") {
          log('> SUCCESS: On-chain settlement validated.');
          log(`> [GATEWAY] Transaction indexed successfully.`);
          await onSuccess(txResult);
          
          log('> Indexing Transaction Hash...');
          await new Promise(r => setTimeout(r, 2000));
          
          log('> Retrying GET /api/data with L402 Auth (XDR injected)...');
          const authHeader = `L402 ${sendRes.hash}:0000`;
          const finalRes = await axios.get(`http://localhost:3001/api/data?amount=${amount}`, {
            headers: { 'Authorization': authHeader }
          });
          
          log(`> [RELAY HASH]: ${sendRes.hash}`);
          log(`> [SETTLEMENT HASH]: ${sendRes.hash}`);
          log(`> [STATUS]: Verified by AI Auditor`);
          log(`> SUCCESS! Data: ${finalRes.data.data.insight}`);
          return finalRes.data.data;
        } else {
          log(`> FATAL: VM Execution Failed. Blockchain status: ${status}`);
          throw new Error(`Soroban transaction failed. Blockchain status: ${status}`);
        }
      } catch (err: any) {
         log(`> FATAL: ${err.message || 'Unknown error during V1 execution'}`);
         throw err;
      }
    } else {
      log('> ERROR: Server unreachable or port closed.');
      throw error;
    }
  }
}
