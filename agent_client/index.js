require('dotenv').config();
const axios = require('axios');
const { Keypair, Networks, TransactionBuilder, Account, Contract, xdr } = require('@stellar/stellar-sdk');
const crypto = require('crypto');

const PROVIDER_URL = process.env.PROVIDER_URL || 'http://localhost:3001/api/data';
const CONTRACT_ID = process.env.CONTRACT_ID || 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KB';
// Se não houver chave no .env, gera uma aleatória para a simulação
const AGENT_SECRET = process.env.AGENT_SECRET_KEY || Keypair.random().secret();

async function main() {
  console.log("🤖 [Agent] Iniciando requisição para a API Premium...");

  try {
    // 1. O Agente tenta acessar os dados sem pagar
    const response = await axios.get(PROVIDER_URL);
    console.log("✅ [Agent] Sucesso inesperado:", response.data);
  } catch (error) {
    // 2. Captura especificamente o erro 402 Payment Required
    if (error.response && error.response.status === 402) {
      console.log("🛑 [Agent] Erro 402: Payment Required interceptado.");
      
      // Em um cenário real do protocolo x402, extraímos os dados do header WWW-Authenticate
      // const authHeader = error.response.headers['www-authenticate'];
      
      // Mockando a extração dos dados da fatura (Invoice)
      const providerAddress = 'GA_MOCK_PROVIDER_ADDRESS_XXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const amountToPay = 50000000; // 5 USDC (em stroops, 7 casas decimais)

      console.log("🛡️ [Agent] Iniciando pagamento via AegisPool (Soroban)...");
      
      // 3. Aciona o contrato Soroban para liberar o pagamento
      const txHash = await payViaSoroban(providerAddress, amountToPay);

      console.log(`🔗 [Agent] Pagamento confirmado! Hash da Transação: ${txHash}`);

      console.log("🔄 [Agent] Refazendo a requisição com o comprovante de pagamento...");
      try {
        // 4. Retentativa (Retry) inserindo o hash da transação no header de autorização
        // O formato L402 exige o mac/preimage, aqui simulamos a injeção do hash da tx
        const authHeader = `L402 ${txHash}:mock_mac_signature`;

        const retryResponse = await axios.get(PROVIDER_URL, {
          headers: {
            'Authorization': authHeader
          }
        });

        // 5. Imprime o resultado final provando o fluxo M2M
        console.log("\n==================================================");
        console.log("🎉 [Agent] SUCESSO! Dados Premium Recebidos:");
        console.log(JSON.stringify(retryResponse.data, null, 2));
        console.log("==================================================\n");

      } catch (retryError) {
        console.error("❌ [Agent] Falha na retentativa:", retryError.message);
      }
    } else {
      console.error("❌ [Agent] Erro desconhecido:", error.message);
    }
  }
}

async function payViaSoroban(providerAddress, amount) {
  const agentKeypair = Keypair.fromSecret(AGENT_SECRET);

  console.log(`📝 [Agent] Preparando invocação do contrato: ${CONTRACT_ID}`);
  console.log(`📝 [Agent] Função: pay`);

  // Parâmetros do Contrato:
  // 1. Secret (32 bytes) - Mockado para simular o ZK commitment reveal
  const secret = crypto.randomBytes(32);

  // 2. Construção da Transação Soroban
  // Usamos uma conta mockada para construir a transação offline sem precisar de fundos reais na Testnet para o script rodar
  const mockAccount = new Account(agentKeypair.publicKey(), "1");
  const contract = new Contract(CONTRACT_ID);

  // Montando os parâmetros XDR para a chamada do contrato
  const secretScVal = xdr.ScVal.scvBytes(secret);
  
  // Tratamento simplificado para o endereço do provedor no XDR
  const providerScVal = xdr.ScVal.scvSymbol("provider_mock"); 
  
  // Tratamento para i128 (amount)
  const amountScVal = xdr.ScVal.scvI128(new xdr.Int128Parts({
    hi: new xdr.Int64(0, 0),
    lo: new xdr.Uint64(amount, 0)
  }));

  const tx = new TransactionBuilder(mockAccount, {
    fee: "10000",
    networkPassphrase: Networks.TESTNET,
  })
  .addOperation(contract.call("pay", secretScVal, providerScVal, amountScVal))
  .setTimeout(30)
  .build();

  // Assinatura da transação (Respeitando o modelo de Contract Authorization da rede Stellar)
  tx.sign(agentKeypair);

  console.log("⏳ [Agent] Simulando envio da transação para a Testnet...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Retorna o hash real da transação gerada localmente como comprovante
  return tx.hash().toString('hex');
}

main();
