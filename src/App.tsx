/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Wallet, Shield, Terminal, Zap, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Keypair, TransactionBuilder, Networks, Contract, rpc, xdr, Account, Asset, Operation, Address, scValToNative } from '@stellar/stellar-sdk';
import axios from 'axios';

export default function App() {
  // Estados Reais sincronizados com Testnet
  const [companyBalance, setCompanyBalance] = useState<number>(0);
  const [poolBalance, setPoolBalance] = useState<number>(0);
  
  const [isDepositing, setIsDepositing] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const fetchBalances = async () => {
    let currentPoolBalance = poolBalance;
    try {
      const treasuryPk = import.meta.env.VITE_TREASURY_PUBLIC_KEY;
      const contractId = import.meta.env.VITE_CONTRACT_ID;
      
      // 1. Fetch XLM balance directly via Horizon for Treasury G-Address
      if (treasuryPk) {
        const tRes = await axios.get(`https://horizon-testnet.stellar.org/accounts/${treasuryPk}`);
        const nativeBalance = tRes.data.balances.find((b: any) => b.asset_type === 'native');
        if (nativeBalance) setCompanyBalance(parseFloat(nativeBalance.balance));
      }
      
      // 2. Fetch Soroban Contract XLM balance via Native Token Contract `balance` invocation
      if (contractId) {
        const server = new rpc.Server('https://soroban-testnet.stellar.org');
        const nativeToken = new Contract('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC');
        const contractAddrScVal = new Address(contractId).toScVal();
        
        const dummyAccount = new Account(treasuryPk || Keypair.random().publicKey(), "1");
        const tx = new TransactionBuilder(dummyAccount, { fee: "100", networkPassphrase: Networks.TESTNET })
          .addOperation(nativeToken.call("balance", contractAddrScVal))
          .setTimeout(30)
          .build();
          
        const sim = await server.simulateTransaction(tx) as any;
        if (sim && sim.result && sim.result.retval) {
           const balanceStroops = scValToNative(sim.result.retval);
           currentPoolBalance = Number(balanceStroops) / 10000000;
           setPoolBalance(currentPoolBalance);
        }
      }
    } catch (e) {
      console.warn("Real-time balance synchronization failed:", e);
    }
    return currentPoolBalance;
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  /**
   * Deposita fundos utilizando um Native Payment de 50 XLM
   * diretamente para o endereço abstrato do Contrato Soroban.
   * Cria registro On-chain no Stellar Expert para o Pitch Video.
   */
  const handleDeposit = async () => {
    if (companyBalance < 50) return;
    setIsDepositing(true);
    
    try {
      const treasurySk = import.meta.env.VITE_TREASURY_SECRET_KEY;
      const contractId = import.meta.env.VITE_CONTRACT_ID;
      
      const treasuryKeypair = Keypair.fromSecret(treasurySk);
      const server = new rpc.Server('https://soroban-testnet.stellar.org');
      
      // Captura o sequence number real (Horizon REST via Axios) para prevenir dessincronia
      const accRes = await axios.get(`https://horizon-testnet.stellar.org/accounts/${treasuryKeypair.publicKey()}`);
      const account = new Account(treasuryKeypair.publicKey(), accRes.data.sequence);

      const contract = new Contract(contractId);
      const nativeAssetContractId = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
      const tokenScVal = new Address(nativeAssetContractId).toScVal();
      
      const fromScVal = new Address(treasuryKeypair.publicKey()).toScVal();
      
      const mockSecret = Buffer.from("zk_signature_mock".padEnd(32, '0'));
      const crypto = window.crypto || (window as any).msCrypto;
      const hashBuffer = await crypto.subtle.digest("SHA-256", mockSecret);
      const commitmentScVal = xdr.ScVal.scvBytes(Buffer.from(hashBuffer));
      
      const amountScVal = xdr.ScVal.scvI128(new xdr.Int128Parts({
        hi: new xdr.Int64(0, 0),
        lo: new xdr.Uint64(500000000, 0) // 50 XLM mockup (Stroops)
      }));

      // Envia os XLM chamando a função deposit do contrato remodelado
      let tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: Networks.TESTNET,
      })
      .addOperation(contract.call("deposit", fromScVal, tokenScVal, commitmentScVal, amountScVal))
      .setTimeout(30)
      .build();

      try {
        tx = await server.prepareTransaction(tx);
      } catch (simError) {
        console.warn("PrepareTransaction falhou:", simError);
      }

      tx.sign(treasuryKeypair);
      const submitRes = await server.sendTransaction(tx);
      
      // Real-time Polling de Status
      setTerminalLogs(prev => [...prev, `> Aguardando validação da Soroban RPC... Hash: ${submitRes.hash}`]);
      
      let status: string = submitRes.status;
      let txResult;
      while (status === "PENDING" || status === "NOT_FOUND") {
        await new Promise(r => setTimeout(r, 2000));
        txResult = await server.getTransaction(submitRes.hash);
        status = txResult.status;
      }
      
      if (status === "SUCCESS") {
        await fetchBalances(); // Substitui a mudança de saldo estática por Sincronia Real
        setTerminalLogs(prev => [...prev, `[SUCCESS] Depósito XLM consolidado on-chain. Transaction Hash: ${submitRes.hash}`]);
      } else {
        throw new Error(`Transação Rejeitada: ${status}`);
      }
    } catch (error) {
      console.error(error);
      setTerminalLogs(prev => [...prev, `> ERROR: Falha técnica ao depositar on-chain.`]);
    } finally {
      setIsDepositing(false);
    }
  };

  // Função real On-Chain do Agente
  const handleTriggerAgent = async () => {
    if (isAgentRunning) return;
    if (poolBalance <= 0) {
      setTerminalLogs(prev => [...prev, '> ERROR 402: Insufficient funds in Shielded Pool. Depositar no mínimo 5 XLM.']);
      return;
    }

    setIsAgentRunning(true);
    setTerminalLogs([]); 

    const log = (msg: string) => setTerminalLogs(prev => [...prev, msg]);

    try {
      log('> GET /api/data... (Without L402 Header)');
      await axios.get('http://localhost:3001/api/data');
      log('> SUCCESS! API acessada sem Header. (Vulnerabilidade!)');
    } catch (error: any) {
      if (error.response?.status === 402) {
        log(`> ERROR 402: Payment Required. Invoice info: ${JSON.stringify(error.response.data)}`);
        log('> Generating ZK Commitment Reveal locally...');
        
        try {
          const agentSk = import.meta.env.VITE_AGENT_SECRET_KEY;
          const contractId = import.meta.env.VITE_CONTRACT_ID;
          
          if (!agentSk || !contractId) throw new Error("VITE_AGENT_SECRET_KEY ausente");
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
            hi: new xdr.Int64(0, 0),
            lo: new xdr.Uint64(50000000, 0) // 5 XLM (M2M Data Price em Stroops)
          }));

          log('> Executing Soroban contract (pay)... Aguardando Testnet...');

          let tx = new TransactionBuilder(account, {
            fee: "1000000",
            networkPassphrase: Networks.TESTNET,
          })
          .addOperation(contract.call("pay", secretScVal, providerScVal, tokenScVal, amountScVal))
          .setTimeout(30)
          .build();
          
          const server = new rpc.Server('https://soroban-testnet.stellar.org');
          
          log('> Verificando provisões do Pool na Testnet....');
          let preparedTx;
          try {
             preparedTx = await server.prepareTransaction(tx);
          } catch (simError: any) {
             console.warn("Simulação falhou:", simError);
             const errMsg = simError?.response?.data?.extras?.resultCodes || simError.message;
             log(`> ERROR VM SOROBAN: falha de simulação ou contrato inacessível. Detalhes: ${JSON.stringify(errMsg)}`);
             throw new Error("Transação falhou na simulação.");
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
          
          if (status === "SUCCESS") {
            let latestPool = await fetchBalances(); // Realtime sync
            if (latestPool === poolBalance) {
               log('> Aguardando propagação do ledger....');
               await new Promise(r => setTimeout(r, 4000));
               await fetchBalances();
            }
            log('> SUCCESS: Pagamento validado on-chain.');
          } else {
             log(`> FATAL: Falha de Execução de VM. Status: ${status}`);
             throw new Error(`Transação Soroban falhou. Status da blockchain: ${status}`);
          }
          
          log('> Aguardando indexamento do Hash pelo nó...');
          await new Promise(r => setTimeout(r, 2000));
          
          log('> Retrying GET /api/data with L402 Auth (XDR injected)...');
          
          const authHeader = `L402 ${sendRes.hash}:0000`;
          const finalRes = await axios.get('http://localhost:3001/api/data', {
            headers: { 'Authorization': authHeader }
          });
          
          log(`> SUCCESS! Data: ${finalRes.data.data.insight}`);
        } catch (err: any) {
           log(`> FATAL: ${err.message || 'Erro desconhecido'}`);
        }
      } else {
        log('> ERROR: Server Inatingivel ou Porta Fechada.');
      }
    } finally {
      setIsAgentRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Aegis<span className="text-indigo-500">402</span>
          </h1>
        </div>
        <div className="text-sm text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Stellar Testnet
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Panel: Corporate Treasury */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <Wallet className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-semibold text-white">Corporate Treasury</h2>
          </div>

          <div className="space-y-6 flex-grow">
            {/* Company Balance */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
              <p className="text-sm text-slate-400 mb-1">Company Balance</p>
              <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                <a 
                  href={`https://stellar.expert/explorer/testnet/account/${import.meta.env.VITE_TREASURY_PUBLIC_KEY}`}
                  target="_blank" rel="noreferrer"
                  className="text-blue-400 font-bold hover:underline cursor-pointer"
                  title="Verifique esta conta no Stellar Expert"
                >
                  {companyBalance.toLocaleString()}
                </a> <span className="text-lg text-slate-500 font-medium">XLM</span>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-6 h-6 text-slate-600 rotate-90 md:rotate-0" />
            </div>

            {/* Shielded Pool Balance */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <p className="text-sm text-indigo-300 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Shielded Pool Balance
              </p>
              <div className="text-3xl font-bold text-white flex items-baseline gap-2">
                <a 
                  href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_CONTRACT_ID}`}
                  target="_blank" rel="noreferrer"
                  className="text-green-400 font-bold hover:underline cursor-pointer"
                  title="Auditar o Smart Contract no Stellar Expert"
                >
                  {poolBalance.toLocaleString()}
                </a> <span className="text-lg text-indigo-400 font-medium">XLM</span>
              </div>
            </div>
          </div>

          {/* Deposit Button */}
          <button
            onClick={handleDeposit}
            disabled={isDepositing || companyBalance < 50}
            className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isDepositing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending to Soroban...
              </>
            ) : (
              <>
                Deposit 50 XLM to Shielded Pool
              </>
            )}
          </button>
        </section>

        {/* Right Panel: AI Agent Terminal */}
        <section className="bg-black border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 text-teal-400" />
              <h2 className="text-xl font-semibold text-white">AI Agent (Data Consumer)</h2>
            </div>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-800"></div>
              <div className="w-3 h-3 rounded-full bg-slate-800"></div>
              <div className="w-3 h-3 rounded-full bg-slate-800"></div>
            </div>
          </div>

          {/* Trigger Button */}
          <button
            onClick={handleTriggerAgent}
            disabled={isAgentRunning || poolBalance <= 0}
            className="mb-6 w-full bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 disabled:border-slate-800 disabled:text-slate-600 disabled:bg-transparent font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isAgentRunning ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
            Trigger Agent (Fetch Market Data)
          </button>

          {/* Terminal Window */}
          <div className="flex-grow bg-[#050505] border border-slate-900 rounded-xl p-5 font-mono text-sm overflow-y-auto h-64">
            <div className="text-slate-500 mb-4">
              // Aegis402 Autonomous Agent initialized.<br/>
              // Waiting for trigger...
            </div>
            
            <div className="space-y-2">
              {terminalLogs.map((log, index) => {
                // Estilização condicional baseada no conteúdo do log
                let logClass = "text-slate-400"; // Logs técnicos em cinza
                if (log.includes("ERROR 402")) logClass = "text-orange-500 font-medium";
                if (log.includes("Transaction Hash")) logClass = "text-slate-300";
                if (log.includes("SUCCESS")) logClass = "text-green-400 font-bold";

                let content: React.ReactNode = log;
                
                // Tratamento de Link Dinâmico para o Contract Hash
                if (log.includes("Transaction Hash:")) {
                  const parts = log.split("Transaction Hash: ");
                  const hashVal = parts[1].trim();
                  // Limpa formatação falsa para garantir url realística se houver
                  const txHashForLink = hashVal.replace('0x', '').replace('...', '');
                  
                  content = (
                    <>
                      {parts[0]}Transaction Hash:{" "}
                      <a 
                        href={`https://stellar.expert/explorer/testnet/tx/${txHashForLink}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-500 font-bold underline hover:text-blue-400 inline-flex items-center gap-1"
                      >
                        {hashVal}
                      </a>
                    </>
                  );
                }

                return (
                  <div key={index} className={`${logClass} animate-in fade-in slide-in-from-bottom-2 duration-300 break-all`}>
                    {content}
                  </div>
                );
              })}
              <div ref={terminalRef} />
              {isAgentRunning && (
                <div className="text-slate-500 animate-pulse">_</div>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* Stellar Expert Footer */}
      <footer className="max-w-7xl mx-auto mt-12 py-6 border-t border-slate-800 text-center">
        <a 
          href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_CONTRACT_ID}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-slate-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-2 font-medium"
        >
          🛡️ Verified AegisPool Smart Contract on Stellar Expert <ArrowRight className="w-4 h-4" />
        </a>
      </footer>
    </div>
  );
}

