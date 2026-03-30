require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
const port = process.env.PORT || 3001;
/**
 * AegisL402 Native Middleware.
 * Padrão HTTP L402 para economia de agentes (Machine-to-Machine).
 */
const aegisL402Middleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Se o Header for ausente ou inválido, retorna fatura L402 (HTTP 402)
  if (!authHeader || !authHeader.startsWith('L402 ')) {
    return res.status(402).json({
      amount: '5',
      asset: 'USDC',
      receiver: process.env.PROVIDER_PUBLIC_KEY,
      message: 'Payment Required via Soroban'
    });
  }

  // Desempacota o comprove de pagamento: Hash da Transação e ZK-Preimage (L402 MOCK)
  const token = authHeader.split(' ')[1];
  const [txHash, preimage] = token.split(':');

  if (txHash) {
    // Validação mockada concluinte: Na blockchain real, chamaríamos Node RPC para conferir `txHash` contra `PROVIDER_PUBLIC_KEY`.
    console.log(`[x402] Transação validada localmente! Hash: ${txHash}`);
    req.paid = true;
    return next();
  }

  return res.status(400).json({ error: 'Invalid L402 Payload' });
};

app.get('/api/data', aegisL402Middleware, (req, res) => {
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
