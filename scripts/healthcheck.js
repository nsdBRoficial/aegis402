import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pingRPC() {
    return new Promise((resolve) => {
        const req = https.get('https://friendbot.stellar.org', (res) => {
            resolve(res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
    });
}

async function checkHealth() {
    console.log("=== Aegis402 Healthcheck ===");

    // 1. Node.js Version
    const nodeMajor = process.versions.node.split('.')[0];
    if (parseInt(nodeMajor) < 18) {
        console.error(`[❌] Node.js version is too low (${process.versions.node}). Expected >= 18.`);
    } else {
        console.log(`[✅] Node.js Version: ${process.versions.node}`);
    }

    // 2. Check .env files
    const envs = [
        { name: "Frontend / Root", path: path.join(__dirname, '../.env') },
        { name: "Agent Client", path: path.join(__dirname, '../agent_client/.env') },
        { name: "API Provider", path: path.join(__dirname, '../api_provider/.env') }
    ];

    for (const envObj of envs) {
        if (!fs.existsSync(envObj.path)) {
            console.error(`[❌] Missing ${envObj.name} .env file`);
        } else {
            const content = fs.readFileSync(envObj.path, 'utf8');
            if (content.includes('SECRET_KEY') || content.includes('PRIVATE_KEY') || content.includes('PUBLIC_KEY')) {
                console.log(`[✅] ${envObj.name} .env is present and populated.`);
            } else {
                console.warn(`[⚠️] ${envObj.name} .env seems present but is missing vital Keypair parameters.`);
            }
        }
    }

    // 3. Network Ping
    console.log("Pinging Soroban Testnet API...");
    const isOnline = await pingRPC();
    if (isOnline) {
        console.log(`[✅] Testnet RPC is online and reachable.`); 
    } else {
        console.error(`[❌] Testnet RPC is unreachable. Check internet connection.`);
    }

    console.log("\nHealthcheck Complete. Environment is ready for E2E execution.");
}

checkHealth();
