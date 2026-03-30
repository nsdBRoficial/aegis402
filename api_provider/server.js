require('dotenv').config();
const express = require('express');
const { X402Provider } = require('@x402/stellar');

const app = express();
const port = process.env.PORT || 3001;

// Configuração do Provedor x402 baseada no SDK oficial
// O middleware interceptará as chamadas e validará a prova de pagamento na Testnet
const x402 = new X402Provider({
  receiver: process.env.PROVIDER_PUBLIC_KEY,
  network: 'TESTNET',
  asset: {
    code: 'USDC',
    issuer: process.env.USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWTTCJM4RTNM62VK3SAWGWLUEXYE61' // Issuer mockado para Testnet
  }
});

// Middleware que protege a rota.
// Se o Header 'Authorization: L402 <mac>:<preimage>' (ou equivalente x402) não estiver presente ou for inválido,
// retorna HTTP 402 Payment Required com os detalhes da fatura (invoice).
const requirePayment = x402.middleware({
  amount: '5.00', // Custo da API: 5 USDC
  description: 'Aegis402 Premium AI Dataset'
});

// Rota protegida
app.get('/api/data', requirePayment, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Pagamento validado com sucesso via x402 Protocol!',
    data: {
      insight: 'A adoção institucional de Privacy Pools em redes públicas aumentará 400% no próximo ano.',
      confidence: 0.98,
      source: 'Aegis402 Shielded Oracle'
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`[Aegis402] API Provider rodando na porta ${port}`);
  console.log(`[Aegis402] Rota protegida: http://localhost:${port}/api/data`);
  console.log(`[Aegis402] Aguardando pagamentos para a carteira: ${process.env.PROVIDER_PUBLIC_KEY}`);
});
