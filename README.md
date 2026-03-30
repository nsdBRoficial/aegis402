# Aegis402 - M2M Privacy Layer on Stellar

Aegis402 is an experimental M2M logic that implements a protocol hybrid of L402 and ZK-Commitments using the Stellar Soroban Smart Contracts framework, designed for seamless automation and verifiable privacy-preserving AI Agent Payments.

**Verified Testnet Contract ID**: `CDVXEHRSSEOJSQS77IJJAGB3ILNNLA3Q66K4CESLZHOGZO3HNDMCTMJK`

## 🏗️ Architecture (L402 + Soroban)

1. **Corporate Treasury**: The entity provides initial liquidity to the pool. When depositing, only the `SHA-256` hash of a private ZK signature mock secret is pushed on-chain, creating a shielded cryptographic commitment.
2. **AI Agent (Data Consumer)**: When the autonomous AI attempts to fetch market data via API, it is challenged with an HTTP 402 Payment Required response.
3. **Soroban Stateless VM**: The Agent responds to the challenge by triggering the Soroban Smart Contract, submitting its native exact preimage (`zk_signature_mock`).
4. **On-Chain Settlement**: The VM executes the hash-check against the cryptographic pool. If the math verifies, the contract (`__check_auth` free/stateless) auto-authorizes and releases XLM to the Data Provider.
5. **API Authentication**: The Agent utilizes the hash of this successful Stellar Transaction to authorize the original API request, fetching the payload.

## 🚀 How to Run

### 1. Requirements
* Node.js v19+

### 2. Run API Provider (Express Middleware)
The API runs a local proxy evaluating L402 metadata on port `3001`:
```bash
cd api_provider
npm install
node server.js
```

### 3. Run Web Dashboard (React & Vite)
Keep the provider running, and initialize the dashboard in a separate terminal:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to visualize the M2M flow and trigger the Autonomous Agent On-Chain Payment cycle!
