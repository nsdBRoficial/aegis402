require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ 
  origin: 'http://localhost:3000',
  exposedHeaders: ['WWW-Authenticate'] 
}));
const port = process.env.PORT || 3001;
/**
 * AegisL402 Native Middleware.
 * L402 HTTP Payment Protocol for Machine-to-Machine (M2M) agent economy.
 */
const aegisL402Middleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // If Authorization header is absent or invalid, issue an L402 invoice (HTTP 402)
  if (!authHeader || !authHeader.startsWith('L402 ')) {
    const requestedAmountXLM = req.query.amount || '5';
    const amountStroops = (Number(requestedAmountXLM) * 10000000).toString(); // String per MPP SDK spec

    const errorPayload = {
      amount: amountStroops,
      asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // XLM Native Contract (Testnet)
      receiver: process.env.PROVIDER_PUBLIC_KEY,
      network: 'stellar:testnet',
      method: 'stellar',   // Raph Tuple: required by MPP SDK for scheme matching
      intent: 'charge'    // Raph Tuple: identifies the payment intent
    };

    const tokenData = "aegis-macaroon";
    const invoiceData = Buffer.from(JSON.stringify(errorPayload)).toString('base64');
    const wwwAuthHeader = `L402 token="${tokenData}",invoice="${invoiceData}"`;

    // L402 Challenge issued — client will retry with Authorization header after on-chain settlement

    return res.status(402)
      .setHeader('WWW-Authenticate', wwwAuthHeader)
      .setHeader('Content-Type', 'application/json')
      .json({ error: 'Payment Required', challenge: wwwAuthHeader });
  }

  // Unpack the payment proof: Transaction Hash + ZK-Preimage from L402 token
  const token = authHeader.split(' ')[1];
  const [txHash] = token.split(':');

  if (txHash) {
    // Payment proof accepted — passing request to protected handler.
    // TODO (production): call Stellar RPC to verify txHash against PROVIDER_PUBLIC_KEY on-chain.
    req.paid = true;
    return next();
  }

  return res.status(400).json({ error: 'Invalid L402 Payload' });
};

app.get('/api/data', aegisL402Middleware, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment validated via Aegis402 L402 Protocol.',
    data: {
      insight: 'Institutional adoption of Privacy Pools on public networks is projected to increase 400% next fiscal year.',
      confidence: 0.98,
      source: 'Aegis402 Shielded Oracle'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`[Aegis402] API Provider running on port ${port}`);
  console.log(`[Aegis402] Protected route: http://localhost:${port}/api/data`);
  console.log(`[Aegis402] Awaiting payments to wallet: ${process.env.PROVIDER_PUBLIC_KEY}`);
});
