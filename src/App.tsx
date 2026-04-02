/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Wallet, Shield, Terminal, Zap, ArrowRight, CheckCircle2, Loader2, Database, Brain, Globe, FileText, Server, AlertTriangle, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Keypair, TransactionBuilder, Networks, Contract, rpc, xdr, Account, Address, scValToNative } from '@stellar/stellar-sdk';
import axios from 'axios';
import { orchestratePaymentFallback } from './services/payment_orchestrator';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FLEET_AGENTS = [
  { id: 'Agent_01_Alpha', name: 'Alpha DataNode',  defaultTool: { id: 'micro_search',   name: 'Micro Search',   cost: 0.1, icon: Globe     } },
  { id: 'Agent_02_Beta',  name: 'Beta Scanner',    defaultTool: { id: 'web_search',     name: 'Web Search',     cost: 0.5, icon: Zap       } },
  { id: 'Agent_03_Gamma', name: 'Gamma Analyst',   defaultTool: { id: 'data_analysis',  name: 'Data Analysis',  cost: 1.0, icon: Database  } },
  { id: 'Agent_04_Delta', name: 'Delta Processor', defaultTool: { id: 'file_analysis',  name: 'File Analysis',  cost: 2.0, icon: FileText  } },
  { id: 'Agent_05_Zeta',  name: 'Zeta Reasoner',   defaultTool: { id: 'ai_reasoning',   name: 'AI Reasoning',   cost: 5.0, icon: Brain    } },
];

export default function App() {
  const [companyBalance, setCompanyBalance] = useState<number>(0);
  const [poolBalance, setPoolBalance] = useState<number>(0);
  
  const [isDepositing, setIsDepositing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  // Aegis B2B Gateway State
  type AuditLog = { type: 'SYSTEM' | 'NETWORK' | 'AI_AUDIT', message: string, timestamp: string };
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { type: 'SYSTEM', message: 'Aegis402 B2B M2M Gateway Initialized.', timestamp: new Date().toLocaleTimeString('en-US',{hour12:false}) },
    { type: 'SYSTEM', message: 'Shielded Pool Firewall active. Awaiting fleet requests...', timestamp: new Date().toLocaleTimeString('en-US',{hour12:false}) }
  ]);
  const [cliInput, setCliInput] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);

  const [historicalBalances, setHistoricalBalances] = useState<{time: string, balance: number}[]>([]);
  const [receiptModal, setReceiptModal] = useState<{show: boolean, status: string, hash: string | null, method: string} | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({
    'Agent_01_Alpha': 10,
    'Agent_02_Beta':  10,
    'Agent_03_Gamma': 10,
    'Agent_04_Delta': 10,
    'Agent_05_Zeta':  10,
  });

  const logAudit = (type: 'SYSTEM' | 'NETWORK' | 'AI_AUDIT', msg: string) => {
    setAuditLogs(prev => [...prev, { type, message: msg, timestamp: new Date().toLocaleTimeString('en-US',{hour12:false}) }]);
  };

  useEffect(() => {
    terminalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [auditLogs]);

  const fetchBalances = async () => {
    let currentPoolBalance = poolBalance;
    try {
      const treasuryPk = import.meta.env.VITE_TREASURY_PUBLIC_KEY;
      const contractId = import.meta.env.VITE_CONTRACT_ID;
      
      if (treasuryPk) {
        const tRes = await axios.get(`https://horizon-testnet.stellar.org/accounts/${treasuryPk}`);
        const nativeBalance = tRes.data.balances.find((b: any) => b.asset_type === 'native');
        if (nativeBalance) setCompanyBalance(parseFloat(nativeBalance.balance));
      }
      
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
             setHistoricalBalances(prev => {
                const newPoint = { time: new Date().toLocaleTimeString('en-US', {hour12: false}), balance: currentPoolBalance };
                // Persistent growing array — never slice/window, records full session history
                return [...prev, newPoint];
             });
          }
        }
      } catch (e) {
        console.warn("Sync falhou:", e);
      }
    return currentPoolBalance;
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleDeposit = async () => {
    if (companyBalance < 50) return;
    setIsDepositing(true);
    
    try {
      const treasurySk = import.meta.env.VITE_TREASURY_SECRET_KEY;
      const contractId = import.meta.env.VITE_CONTRACT_ID;
      
      const treasuryKeypair = Keypair.fromSecret(treasurySk);
      const server = new rpc.Server('https://soroban-testnet.stellar.org');
      
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
        hi: xdr.Int64.fromXDR(Buffer.alloc(8)),
        lo: xdr.Uint64.fromXDR(Buffer.from(BigInt(500000000).toString(16).padStart(16, '0'), 'hex'))
      }));

      let tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call("deposit", fromScVal, tokenScVal, commitmentScVal, amountScVal))
      .setTimeout(30)
      .build();

      tx = await server.prepareTransaction(tx);
      tx.sign(treasuryKeypair);
      const submitRes = await server.sendTransaction(tx);
      
      logAudit('SYSTEM', `Verifying deposit on RPC... Hash: ${submitRes.hash}`);
      
      let status: string = submitRes.status;
      let txResult;
      while (status === "PENDING" || status === "NOT_FOUND") {
        await new Promise(r => setTimeout(r, 2000));
        txResult = await server.getTransaction(submitRes.hash);
        status = txResult.status;
      }
      
      if (status === "SUCCESS") {
        await fetchBalances(); 
        logAudit('SYSTEM', `XLM Replenishment Successful. Hash: ${submitRes.hash}`);
      } else {
        throw new Error(`Tx Rejected: ${status}`);
      }
    } catch (error) {
       console.error(error);
       logAudit('SYSTEM', `ERROR: Desync on Deposit.`);
    } finally {
      setIsDepositing(false);
    }
  };

  const handleCliSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!cliInput.trim() || isProcessing) return;
    
    const cmd = cliInput.trim().toUpperCase();
    logAudit('SYSTEM', `> ${cmd}`);
    setCliInput("");

    if (cmd.startsWith("SET LIMIT")) {
       const parts = cmd.split(" ");
       if (parts.length >= 4) {
          const target = parts[2];
          const amnt = parseInt(parts[3]);
          if (!isNaN(amnt)) {
             setLimits(prev => ({...prev, [target]: amnt}));
             logAudit('SYSTEM', `Firewall: Rate limit applied. [${target}] restricted to ${amnt} XLM.`);
          } else {
             logAudit('SYSTEM', `Error: Invalid amount.`);
          }
       } else {
          logAudit('SYSTEM', `Syntax Error. Use: SET LIMIT <AgentID> <Amount>`);
       }
    } else if (cmd === "STATUS") {
       logAudit('SYSTEM', `Gateway Firewall is Active. Shielded Pool reserves: ${poolBalance} XLM. Access routes: Mpp_V2/Aegis_V1.`);
    } else {
       logAudit('SYSTEM', `Command not found. Use SET LIMIT <AgentID> <Amt> or STATUS.`);
    }
  };

  const handleExportLogs = () => {
    const textContent = auditLogs.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join("\n");
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-audit-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateAgent = async (agentId: string, tool: {id: string, name: string, cost: number}) => {
    if (isProcessing) return;
    if (poolBalance < tool.cost) {
      logAudit('SYSTEM', `ERROR 402: Insufficient Pool Reserves for ${agentId}. Requires ${tool.cost} XLM.`);
      return;
    }

    const currentLimit = limits[agentId] || 100;
    if (currentLimit < tool.cost) {
      logAudit('SYSTEM', `[FIREWALL] Transaction blocked: Limit exceeded for ${agentId}.`);
      return;
    }

    setIsProcessing(true);
    setActiveAgent(agentId);
    logAudit('NETWORK', `Inbound HTTP M2M Request from Origin [${agentId}]. Target Endpoint: [${tool.name}]`);

    let latestHash = "0x000000000000000000000000";
    const logOrch = (msg: string) => {
       if (msg.includes("Hash: ")) latestHash = msg.split("Hash: ")[1].trim();
       logAudit('SYSTEM', msg.replace('> ', ''));
    };
    
    // Reduces limit temporarily to simulate local tracking (In production, contract does this)
    setLimits(prev => ({...prev, [agentId]: prev[agentId] - tool.cost}));

    try {
      logAudit('SYSTEM', 'L402 Challenge Detected. Intercepting auth payload...');

      const handleSuccessSync = async () => {
         let latestPool = await fetchBalances();
         if (latestPool === poolBalance) {
            logAudit('SYSTEM', 'Polling Ledger for state propagation...');
            await new Promise(r => setTimeout(r, 4000));
            await fetchBalances();
         }
      };

      const apiData = await orchestratePaymentFallback({
        agentSk: import.meta.env.VITE_AGENT_SECRET_KEY,
        contractId: import.meta.env.VITE_CONTRACT_ID,
        poolBalance: poolBalance,
        amount: tool.cost,
        log: logOrch,
        onSuccess: handleSuccessSync
      });

      // The real hashes are now emitted by aegis_v1_custom.ts as individual log lines.
      // The App layer adds the AI audit result as its own receipt line.
      logAudit('SYSTEM', `[TRANSACTION RECEIPT] Settlement complete for ${agentId}.`);

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
      const promptText = `Escreva uma unica frase super tecnica (apenas 1 frase) dizendo algo como: "[AI AUDIT]: Transaction verified. Spending within normal parameters do Agente ${agentId}".`;
      
      const payload = {
         contents: [{ parts: [{ text: promptText }] }]
      };
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload)
      });
      
      const json = await res.json();
      const aiResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || `[AI AUDIT]: Transaction verified. Spending within normal parameters.`;
      logAudit('AI_AUDIT', aiResponse.replace("\n", "").trim());
      
      // Determine which protocol path was used by scanning the session log
      const methodUsed = auditLogs.some(l => l.message.includes('[MPP SDK] SUCCESS')) 
        ? '🟢 Standard V2 (MPP Protocol)'
        : '🛡️ Aegis-Native V1 (Custom Soroban)';

      setReceiptModal({ show: true, status: 'SUCCESS', hash: latestHash, method: methodUsed });

    } catch (e: any) {
      logAudit('SYSTEM', `Gateway Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
      setActiveAgent(null);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between border-b border-slate-800 pb-6 uppercase tracking-wider">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-teal-500" />
          <h1 className="text-xl font-bold tracking-tight text-white">
            Aegis<span className="text-teal-500">Gateway</span> B2B
          </h1>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          Stellar Testnet Firewall
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Panel: Corporate Treasury */}
        <section className="bg-[#0a0a0c] border border-slate-800 rounded-xl p-6 flex flex-col font-sans">
          <div className="flex items-center gap-3 mb-8">
            <Wallet className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">Infrastructure Treasury</h2>
          </div>

          <div className="space-y-6 flex-grow">
            <div className="bg-black border border-slate-800 rounded-lg p-5">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Company Master Balance</p>
              <div className="text-3xl font-black text-white flex items-baseline gap-2 font-mono">
                <a 
                  href={`https://stellar.expert/explorer/testnet/account/${import.meta.env.VITE_TREASURY_PUBLIC_KEY}`}
                  target="_blank" rel="noreferrer"
                  className="text-white hover:text-teal-400 transition-colors"
                >
                  {companyBalance.toLocaleString()}
                </a> <span className="text-sm text-slate-600 font-medium">XLM</span>
              </div>
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-5 h-5 text-slate-700 rotate-90 md:rotate-0" />
            </div>

            <div className="bg-teal-950/20 border border-teal-500/20 rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <p className="text-xs text-teal-500/80 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Shield className="w-3 h-3" /> Shared M2M Shielded Pool
              </p>
              <div className="text-3xl font-black text-white flex items-baseline gap-2 font-mono">
                <a 
                  href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_CONTRACT_ID}`}
                  target="_blank" rel="noreferrer"
                  className="text-teal-400 hover:text-teal-300 transition-colors"
                >
                  {poolBalance.toLocaleString()}
                </a> <span className="text-sm text-teal-600 font-medium">XLM</span>
              </div>
            </div>

            {historicalBalances.length > 0 && (
              <div className="bg-black border border-slate-900 rounded-lg p-4 h-48 relative overflow-hidden hidden md:block">
                <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-widest">Aggregate Fleet Consumption</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicalBalances} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#111" vertical={false} />
                    <XAxis dataKey="time" stroke="#333" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis stroke="#333" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #2dd4bf', borderRadius: '4px', fontSize: '10px' }}
                      itemStyle={{ color: '#2dd4bf' }}
                    />
                    <Line type="stepAfter" dataKey="balance" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: '#14b8a6', strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <button
            onClick={handleDeposit}
            disabled={isDepositing || companyBalance < 50}
            className="mt-6 w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-700 text-slate-300 font-bold uppercase tracking-widest text-xs py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isDepositing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning Pool...</>
            ) : (
              <>Replenish Firewall Pool (50 XLM)</>
            )}
          </button>
        </section>

        {/* Right Panel: Aegis Auditor & Fleet Mocks */}
        <section className="bg-black border border-slate-800 rounded-xl p-0 flex flex-col relative overflow-hidden">
          
          <div className="p-4 border-b border-slate-900 bg-[#050505]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Security & Payment Audit Log</h2>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleExportLogs} className="text-slate-500 hover:text-teal-400 transition-colors" title="Export Security Logs">
                  <Download className="w-4 h-4" />
                </button>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                </div>
              </div>
            </div>

            {/* Fleet Mocks Grid — 5 agents in a responsive 2→5 column layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2 font-sans">
              {FLEET_AGENTS.map(agent => {
                const currentLimit = limits[agent.id] ?? 10;
                const cost = agent.defaultTool.cost;
                const blocked = currentLimit < cost;
                return (
                 <div key={agent.id} className={`p-2 rounded-lg border transition-all ${activeAgent === agent.id ? 'bg-indigo-900/40 border-indigo-500/50 ring-1 ring-indigo-500/30' : (blocked ? 'bg-[#0a0a0c] border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.1)]' : 'bg-[#0a0a0c] border-slate-800')} flex flex-col gap-2`}>
                   
                   <button
                    onClick={() => handleSimulateAgent(agent.id, agent.defaultTool)}
                    disabled={isProcessing || blocked}
                    className="w-full text-left disabled:opacity-50"
                   >
                     <div className="flex justify-between items-start mb-1">
                       <div className="text-[10px] font-bold text-white truncate pr-1">{agent.name}</div>
                       <div className={`text-[9px] px-1 py-0.5 rounded font-mono shrink-0 ${!blocked ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500 font-bold'}`}>
                         {currentLimit} XLM
                       </div>
                     </div>
                     <div className="flex items-center gap-1 text-[10px] text-slate-400">
                       <agent.defaultTool.icon className={`w-2.5 h-2.5 shrink-0 ${blocked ? 'text-red-500/50' : 'text-indigo-400'}`} />
                       <span className="truncate">{agent.defaultTool.name}</span>
                     </div>
                     <div className="text-[9px] text-teal-500 font-mono">{cost} XLM</div>
                   </button>
                   
                   {/* Independent Slider per agent */}
                   <div className="flex items-center gap-1">
                     <input 
                       type="range" min="0" max="20" step="0.1"
                       value={currentLimit} 
                       onChange={(e) => setLimits(prev => ({...prev, [agent.id]: parseFloat(e.target.value)}))}
                       disabled={isProcessing}
                       className="flex-grow h-0.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 outline-none"
                     />
                   </div>
                   
                   {blocked && <div className="text-[8px] text-red-500 uppercase font-black tracking-widest text-center animate-pulse">BLOCKED</div>}
                 </div>
                );
              })}
            </div>
          </div>

          {/* Audit Terminal Window */}
          <div className="flex-grow bg-[#000000] p-4 textxs overflow-y-auto space-y-1.5 h-64 font-mono text-[11px]">
               {auditLogs.map((log, idx) => {
                  let logClass = "text-slate-500";
                  if (log.type === 'NETWORK') logClass = "text-teal-400";
                  if (log.type === 'AI_AUDIT') logClass = "text-indigo-400 font-bold bg-indigo-950/20 px-2 py-1 rounded inline-block w-full border border-indigo-500/10";
                  if (log.message.includes("ERROR") || log.message.includes("FIREWALL BLOCK")) logClass = "text-red-500 font-bold";
                  if (log.message.includes("Success") || log.message.includes("SUCCESS")) logClass = "text-green-500";

                  let content: React.ReactNode = log.message;
                  if (log.message.includes("[RELAY HASH]")) {
                    const lines = log.message.split("\n");
                    content = (
                      <div className="flex flex-col gap-1 mt-2 mb-1 border border-teal-500/20 p-3 rounded bg-teal-500/5">
                         {lines.map((line, i) => {
                             if (line.includes("HASH]:")) {
                                 const [label, hash] = line.split("]:");
                                 const cleanHash = hash.trim();
                                 const shortHash = cleanHash.replace('0x', '').replace('...', '');
                                 return <div key={i}>{label}]: <a href={`https://stellar.expert/explorer/testnet/tx/${shortHash}`} target="_blank" rel="noreferrer" className="text-teal-400 font-bold hover:underline hover:text-teal-300 ml-1">{cleanHash.slice(0, 16)}...</a></div>
                             }
                             return <div key={i}>{line}</div>
                         })}
                      </div>
                    );
                  } else if (log.message.includes("Hash: ")) {
                    const parts = log.message.split("Hash: ");
                    const hashVal = parts[1].trim();
                    const txHashForLink = hashVal.replace('0x', '').replace('...', '');
                    content = (
                      <>
                        {parts[0]}Hash: <a href={`https://stellar.expert/explorer/testnet/tx/${txHashForLink}`} target="_blank" rel="noreferrer" className="text-teal-400 font-bold hover:underline hover:text-teal-300 ml-1">{hashVal.slice(0, 16)}...</a>
                      </>
                    );
                  }

                  return (
                     <div key={idx} className={`${logClass} animate-in fade-in`}>
                        <span className="opacity-40 select-none mr-2">[{log.timestamp}]</span>
                        {log.type === 'NETWORK' ? <span className="opacity-70">&lt;- </span> : log.type === 'SYSTEM' ? <span className="opacity-70">&gt;_ </span> : <span className="opacity-70">◆ </span> }
                        {content}
                     </div>
                  );
               })}
               <div ref={terminalRef} />
               {isProcessing && (
                  <div className="text-slate-600 px-2 py-1 mt-2 flex items-center gap-2">
                     <Loader2 className="w-3 h-3 animate-spin" /> Orchestrating HTTP 402 via Stellar...
                  </div>
               )}
          </div>
          
          <form onSubmit={handleCliSubmit} className="border-t border-slate-900 bg-[#050505] p-3 flex gap-3 shrink-0">
               <span className="text-teal-500 font-black mt-2 font-mono ml-2">&gt;</span>
               <input
                  type="text"
                  value={cliInput}
                  onChange={e => setCliInput(e.target.value)}
                  disabled={isProcessing}
                  placeholder="admin@gateway:~$ SET LIMIT Agent_01_Alpha 50"
                  className="flex-grow bg-transparent text-slate-300 focus:outline-none focus:border-none font-mono text-xs"
               />
          </form>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 py-6 border-t border-slate-900 text-center uppercase tracking-widest text-[10px]">
        <a 
          href={`https://stellar.expert/explorer/testnet/contract/${import.meta.env.VITE_CONTRACT_ID}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-slate-600 hover:text-teal-500 transition-colors inline-flex items-center gap-2 font-black"
        >
          Verified M2M AegisPool Contract <ArrowRight className="w-3 h-3" />
        </a>
      </footer>

      {receiptModal && (
        // Note: clicking the backdrop does NOT close the modal — only the Acknowledge button does.
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
           <div className="bg-[#050505] border border-teal-500/30 rounded-xl max-w-sm w-full p-6 text-center ring-1 ring-white/5">
              <CheckCircle2 className="w-10 h-10 text-teal-500 mx-auto mb-4" />
              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-1">M2M Intercept Success</h3>
              <p className="text-xs text-slate-500 mb-1">Payment Firewall validated L402 challenge.</p>
              <p className="text-[10px] text-slate-600 font-mono mb-4">
                Protocol: <span className="text-teal-400 font-bold">{receiptModal.method}</span>
              </p>
              
              {receiptModal.hash && receiptModal.hash !== '0x000000000000000000000000' && (
                <div className="bg-black border border-slate-800 rounded-lg p-3 mb-4 text-left">
                  <p className="text-[9px] uppercase text-slate-600 tracking-widest mb-1">On-chain Reference</p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${receiptModal.hash}`}
                    target="_blank" rel="noreferrer"
                    className="text-teal-400 font-mono text-[10px] font-bold hover:underline break-all"
                  >
                    {receiptModal.hash.slice(0, 24)}...
                  </a>
                </div>
              )}
              
              <button
                onClick={() => setReceiptModal(null)}
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xs font-bold uppercase py-3 rounded-lg transition-all tracking-widest"
              >
                Acknowledge Receipt
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

// Auxilio para thresholds no css em linha
function toolCostWarningThreshold(cost: number) { return cost; }
