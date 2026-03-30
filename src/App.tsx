/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Wallet, Shield, Terminal, Zap, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

export default function App() {
  // Estados do Tesouro Corporativo
  const [companyBalance, setCompanyBalance] = useState(10000);
  const [poolBalance, setPoolBalance] = useState(0);
  const [isDepositing, setIsDepositing] = useState(false);

  // Estados do Agente de IA
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll do terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // Função para simular o depósito (Corporate Treasury)
  const handleDeposit = () => {
    if (companyBalance < 50) return;
    setIsDepositing(true);
    
    // Simula o delay da rede Stellar
    setTimeout(() => {
      setCompanyBalance(prev => prev - 50);
      setPoolBalance(prev => prev + 50);
      setIsDepositing(false);
    }, 1500);
  };

  // Função para simular o fluxo do Agente (M2M Payment)
  const handleTriggerAgent = () => {
    if (isAgentRunning) return;
    if (poolBalance < 5) {
      setTerminalLogs(prev => [...prev, '> ERROR: Insufficient funds in Shielded Pool.']);
      return;
    }

    setIsAgentRunning(true);
    setTerminalLogs([]); // Limpa o terminal

    const steps = [
      { msg: '> GET /api/data...', delay: 1000 },
      { msg: '> ERROR 402: Payment Required. Invoice: 5 USDC.', delay: 2000 },
      { msg: '> Generating ZK Commitment Reveal...', delay: 3000 },
      { msg: '> Executing Soroban contract (pay)...', delay: 4000 },
      { 
        msg: '> Transaction Hash: 0x43a5fc89b21a7c99d3e4f...', 
        delay: 5000,
        action: () => setPoolBalance(prev => prev - 5) // Deduz do pool no momento da transação
      },
      { msg: '> Retrying GET /api/data with L402 Auth...', delay: 6000 },
      { 
        msg: '> SUCCESS! Data: Institutional adoption of Privacy Pools will increase 400%.', 
        delay: 7000,
        action: () => setIsAgentRunning(false)
      }
    ];

    steps.forEach(({ msg, delay, action }) => {
      setTimeout(() => {
        setTerminalLogs(prev => [...prev, msg]);
        if (action) action();
      }, delay);
    });
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
                {companyBalance.toLocaleString()} <span className="text-lg text-slate-500 font-medium">USDC</span>
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
                {poolBalance.toLocaleString()} <span className="text-lg text-indigo-400 font-medium">USDC</span>
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
                Processing on Stellar...
              </>
            ) : (
              <>
                Deposit 50 USDC to Shielded Pool
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
            disabled={isAgentRunning || poolBalance < 5}
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
          <div 
            ref={terminalRef}
            className="flex-grow bg-[#050505] border border-slate-900 rounded-xl p-5 font-mono text-sm overflow-y-auto h-64"
          >
            <div className="text-slate-500 mb-4">
              // Aegis402 Autonomous Agent initialized.<br/>
              // Waiting for trigger...
            </div>
            
            <div className="space-y-2">
              {terminalLogs.map((log, index) => {
                // Estilização condicional baseada no conteúdo do log
                let logClass = "text-slate-300";
                if (log.includes("ERROR 402")) logClass = "text-yellow-400";
                if (log.includes("Transaction Hash")) logClass = "text-indigo-400";
                if (log.includes("SUCCESS")) logClass = "text-teal-400 font-bold";

                return (
                  <div key={index} className={`${logClass} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    {log}
                  </div>
                );
              })}
              {isAgentRunning && (
                <div className="text-slate-500 animate-pulse">_</div>
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

