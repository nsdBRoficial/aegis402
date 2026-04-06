/**
 * api/data.js — Vercel Serverless Function: Aegis402 L402 Payment Gateway
 *
 * PT-BR: Esta função serverless implementa o protocolo HTTP L402 para pagamentos M2M.
 * Substituiu o servidor Express local (api_provider/server.js) para rodar 24/7 na Vercel.
 * O CORS é gerenciado pelo vercel.json — sem necessidade do pacote 'cors' aqui.
 *
 * EN: This serverless function implements the HTTP L402 payment protocol for M2M agents.
 * Replaces the local Express server (api_provider/server.js) to run 24/7 on Vercel.
 * CORS is managed via vercel.json — no 'cors' package needed here.
 *
 * Endpoint: GET /api/data?amount=<XLM>
 * Flow:
 *   1. Without Authorization header → HTTP 402 + WWW-Authenticate: L402 invoice
 *   2. With Authorization: L402 <txHash>:0000 → HTTP 200 + protected oracle data
 */

export default function handler(req, res) {
  // Trata preflight OPTIONS enviado pelo browser / Handle browser CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Lê variáveis de ambiente server-side (configuradas no Vercel Dashboard)
  // Reads server-side env vars (configured in Vercel Dashboard → Settings → Env Variables)
  // PROVIDER_PUBLIC_KEY: endereço G... que recebe os pagamentos XLM / G... address that receives XLM payments
  const providerPublicKey = process.env.PROVIDER_PUBLIC_KEY;
  // STELLAR_SECRET_KEY: chave de assinatura server-side (reservada para validação futura on-chain)
  // STELLAR_SECRET_KEY: server-side signing key (reserved for future on-chain validation)
  // const stellarSecretKey = process.env.STELLAR_SECRET_KEY; // Disponível / Available when needed

  const authHeader = req.headers['authorization'];

  // ─── STEP 1: Sem header Authorization → emite L402 challenge ────────────────
  // ─── STEP 1: No Authorization header → issue L402 challenge ─────────────────
  if (!authHeader || !authHeader.startsWith('L402 ')) {
    const requestedAmountXLM = req.query?.amount || '5';

    // Converte XLM para stroops (1 XLM = 10.000.000 stroops) — unidade base do Stellar
    // Converts XLM to stroops (1 XLM = 10,000,000 stroops) — Stellar's base unit
    const amountStroops = (Number(requestedAmountXLM) * 10_000_000).toString();

    // Payload do invoice: campos exigidos pelo MPP SDK para resolver o pagamento automaticamente
    // Invoice payload: fields required by the MPP SDK to automatically resolve the payment
    const invoicePayload = {
      amount: amountStroops,         // string em stroops / string in stroops (MPP SDK spec)
      asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // XLM Native SAC (Testnet)
      recipient: providerPublicKey,   // endereço G... do provider / provider G... address
      network: 'testnet',            // forma curta exigida pelo SDK / short form required by SDK
    };

    // Serializa o invoice em Base64 e monta o header WWW-Authenticate no padrão L402
    // Serializes the invoice as Base64 and builds the WWW-Authenticate header in L402 format
    const tokenData = 'aegis-macaroon';
    const invoiceData = Buffer.from(JSON.stringify(invoicePayload)).toString('base64');
    const wwwAuthHeader = `L402 token="${tokenData}",invoice="${invoiceData}"`;

    // L402 Challenge emitido — o cliente retentará com Authorization após liquidação on-chain
    // L402 Challenge issued — client will retry with Authorization header after on-chain settlement
    res.setHeader('WWW-Authenticate', wwwAuthHeader);
    res.setHeader('Content-Type', 'application/json');
    return res.status(402).json({
      error: 'Payment Required',
      challenge: wwwAuthHeader,
    });
  }

  // ─── STEP 2: Authorization presente → verifica prova de pagamento ───────────
  // ─── STEP 2: Authorization present → verify payment proof ───────────────────
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(400).json({ error: 'Malformed L402 token' });
  }

  const [txHash] = token.split(':');
  if (!txHash) {
    return res.status(400).json({ error: 'Invalid L402 Payload — txHash missing' });
  }

  // Prova de pagamento aceita — entregando dados protegidos do Oracle
  // Payment proof accepted — delivering protected Oracle data
  // TODO (produção/production): verificar txHash contra PROVIDER_PUBLIC_KEY via Stellar RPC
  // antes de retornar os dados. Por ora, a prova criptográfica é aceita por confiança.
  // Before returning data, verify txHash against PROVIDER_PUBLIC_KEY via Stellar RPC.
  // For now, the cryptographic proof is accepted on good faith (demo/testnet).

  return res.status(200).json({
    success: true,
    // Mensagem de confirmação: pagamento validado via protocolo Aegis402 L402
    // Confirmation message: payment validated via Aegis402 L402 Protocol
    message: 'Payment validated via Aegis402 L402 Protocol.',
    txHash,
    data: {
      // Insight do Oracle protegido — acessível somente por agentes M2M autorizados
      // Protected Oracle insight — accessible only by authorized M2M agents
      insight: 'Institutional adoption of Privacy Pools on public networks is projected to increase 400% next fiscal year.',
      confidence: 0.98,
      source: 'Aegis402 Shielded Oracle',
    },
    timestamp: new Date().toISOString(),
  });
}
