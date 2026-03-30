import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Keypair } from '@stellar/stellar-sdk';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fundAccount(publicKey, name) {
    console.log(`[${name}] Funding Testnet account: ${publicKey}...`);
    try {
        const response = await axios.get(`https://friendbot.stellar.org/?addr=${publicKey}`);
        console.log(`[${name}] ✅ Success! Funded 10,000 XLM.`);
    } catch (e) {
        console.error(`[${name}] ❌ Error funding account:`, e.response?.data || e.message);
    }
}

async function main() {
    console.log("Generating Keypairs...");
    const treasury = Keypair.random();
    const agent = Keypair.random();
    const provider = Keypair.random();

    console.log(`Treasury (Empresa) Public: ${treasury.publicKey()}`);
    console.log(`Agent (Pagador) Public:   ${agent.publicKey()}`);
    console.log(`Provider (Recebedor) Public: ${provider.publicKey()}`);

    await fundAccount(treasury.publicKey(), "Treasury");
    await fundAccount(agent.publicKey(), "Agent");
    await fundAccount(provider.publicKey(), "Provider");

    const apiProviderEnvPath = path.join(__dirname, '../api_provider/.env');
    const apiProviderContent = `PORT=3001
PROVIDER_PUBLIC_KEY="${provider.publicKey()}"
PROVIDER_SECRET_KEY="${provider.secret()}"
USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWTTCJM4RTNM62VK3SAWGWLUEXYE61"
`;
    fs.writeFileSync(apiProviderEnvPath, apiProviderContent);

    const agentClientEnvPath = path.join(__dirname, '../agent_client/.env');
    const agentClientContent = `PROVIDER_URL="http://localhost:3001/api/data"
AGENT_PUBLIC_KEY="${agent.publicKey()}"
AGENT_SECRET_KEY="${agent.secret()}"
CONTRACT_ID=""
`;
    fs.writeFileSync(agentClientEnvPath, agentClientContent);

    const frontendEnvPath = path.join(__dirname, '../.env');
    const frontendContent = `VITE_TREASURY_PUBLIC_KEY="${treasury.publicKey()}"
VITE_TREASURY_SECRET_KEY="${treasury.secret()}"
VITE_CONTRACT_ID=""
`;
    fs.writeFileSync(frontendEnvPath, frontendContent);

    console.log("✅ Successfully created .env files for api_provider, agent_client and frontend (root).");
}

main();
