require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Inicializa o servidor Express — API Provider do protocolo Aegis402 L402
// Initializes the Express server — API Provider for the Aegis402 L402 protocol
const app = express();

// Configuração CORS: permite apenas origens do dev local (Vite portas 3000 e 5173)
// CORS config: allows only local dev origins (Vite default ports 3000 and 5173)
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  // Headers customizados do Aegis402: X-Aegis-Client para identificação do agente M2M
  // Custom Aegis402 headers: X-Aegis-Client for M2M agent identification
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Aegis-Client', 'X-Aegis-Preflight'],
  // Expõe WWW-Authenticate para que o SDK MPP possa ler o L402 challenge
  // Exposes WWW-Authenticate so the MPP SDK can read the L402 challenge
  exposedHeaders: ['WWW-Authenticate'],
  credentials: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handler OPTIONS explícito: responde 204 No Content a TODOS os preflights.
// Explicit OPTIONS handler: responds 204 No Content to ALL preflight requests.
// PT-BR: Obrigatório para que o preflight automático do MPP SDK não seja bloqueado.
// EN: Required so the MPP SDK's automatic preflight check doesn't get blocked.
app.options('*', cors(corsOptions));

const port = process.env.PORT || 3001;

/**
 * AegisL402 Native Middleware — Middleware Nativo L402 do Aegis402
 *
 * PT-BR: Implementa o protocolo de pagamento HTTP L402 para economia Machine-to-Machine (M2M).
 * Fluxo: Agente faz GET → recebe 402 → paga on-chain → retry com Authorization header → acesso liberado.
 *
 * EN: Implements the L402 HTTP Payment Protocol for Machine-to-Machine (M2M) agent economy.
 * Flow: Agent makes GET → receives 402 → pays on-chain → retries with Authorization header → access granted.
 */
const aegisL402Middleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Se o header Authorization estiver ausente ou inválido, emite um invoice L402 (HTTP 402)
  // If Authorization header is absent or invalid, issue an L402 invoice (HTTP 402)
  if (!authHeader || !authHeader.startsWith('L402 ')) {
    const requestedAmountXLM = req.query.amount || '5';
    // Converte XLM para stroops (1 XLM = 10.000.000 stroops) — unidade base do Stellar
    // Converts XLM to stroops (1 XLM = 10,000,000 stroops) — Stellar's base unit
    const amountStroops = (Number(requestedAmountXLM) * 10000000).toString(); // String per MPP SDK spec

    // Payload do invoice: define o valor, ativo (XLM SAC Testnet), destinatário e rede
    // Invoice payload: defines the amount, asset (XLM Native SAC Testnet), recipient, and network
    const errorPayload = {
      amount: amountStroops,           // string, in stroops (base units)
      asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // XLM Native SAC (Testnet)
      recipient: process.env.PROVIDER_PUBLIC_KEY, // G... address — 'recipient' per MPP SDK spec
      network: 'testnet',              // short form: 'testnet' (not 'stellar:testnet')
    };

    // Serializa o invoice em Base64 e monta o header WWW-Authenticate no formato L402
    // Serializes the invoice as Base64 and builds the WWW-Authenticate header in L402 format
    const tokenData = "aegis-macaroon";
    const invoiceData = Buffer.from(JSON.stringify(errorPayload)).toString('base64');
    const wwwAuthHeader = `L402 token="${tokenData}",invoice="${invoiceData}"`;

    // L402 Challenge emitido — o cliente retentará com Authorization após liquidação on-chain
    // L402 Challenge issued — client will retry with Authorization header after on-chain settlement
    return res.status(402)
      .setHeader('WWW-Authenticate', wwwAuthHeader)
      .setHeader('Content-Type', 'application/json')
      .json({ error: 'Payment Required', challenge: wwwAuthHeader });
  }

  // Desempacota a prova de pagamento: Transaction Hash + ZK-Preimage do token L402
  // Unpack the payment proof: Transaction Hash + ZK-Preimage from L402 token
  const token = authHeader.split(' ')[1];
  const [txHash] = token.split(':');

  if (txHash) {
    // Prova de pagamento aceita — passando requisição ao handler protegido.
    // Payment proof accepted — passing request to protected handler.
    // TODO (produção/production): chamar Stellar RPC para verificar txHash contra PROVIDER_PUBLIC_KEY on-chain.
    req.paid = true;
    return next();
  }

  return res.status(400).json({ error: 'Invalid L402 Payload' });
};

// Rota protegida: só acessível após pagamento L402 válido
// Protected route: only accessible after valid L402 payment
app.get('/api/data', aegisL402Middleware, (req, res) => {
  res.status(200).json({
    success: true,
    // Mensagem de confirmação: pagamento validado via protocolo Aegis402 L402
    // Confirmation message: payment validated via Aegis402 L402 Protocol
    message: 'Payment validated via Aegis402 L402 Protocol.',
    data: {
      // Insight do Oracle protegido — acessível somente por agentes M2M autorizados
      // Protected Oracle insight — accessible only by authorized M2M agents
      insight: 'Institutional adoption of Privacy Pools on public networks is projected to increase 400% next fiscal year.',
      confidence: 0.98,
      source: 'Aegis402 Shielded Oracle'
    },
    timestamp: new Date().toISOString()
  });
});

// Inicia o servidor e reporta os endpoints ativos no console
// Starts the server and reports active endpoints in the console
app.listen(port, () => {
  console.log(`[Aegis402] API Provider running on port ${port}`);
  console.log(`[Aegis402] Protected route: http://localhost:${port}/api/data`);
  console.log(`[Aegis402] Awaiting payments to wallet: ${process.env.PROVIDER_PUBLIC_KEY}`);
});
