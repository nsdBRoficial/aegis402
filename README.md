# Aegis402 — M2M Payment Gateway on Stellar

Aegis402 is a **B2B Machine-to-Machine (M2M) Payment Firewall** built on the Stellar Soroban smart contract platform. It implements a hybrid **L402 + ZK-Commitment** protocol that allows autonomous AI agents to settle microtransactions in real-time, without human intervention, while providing a corporate treasury with full spending controls and AI-powered audit trails.

**Verified Testnet Contract**: [`CDVXEHRSSEOJSQS77IJJAGB3ILNNLA3Q66K4CESLZHOGZO3HNDMCTMJK`](https://stellar.expert/explorer/testnet/contract/CDVXEHRSSEOJSQS77IJJAGB3ILNNLA3Q66K4CESLZHOGZO3HNDMCTMJK)

---

## 🏗️ Architecture: The Aegis Shielded Pool

1. **Corporate Treasury (Shielded Deposit)**: The master treasury deposits initial liquidity into the Aegis Shielded Pool. Instead of exposing the treasury's address or agent wallets, only the `SHA-256` hash of a private ZK signature secret is pushed on-chain, creating a **Shielded Cryptographic Commitment**.
2. **Fleet Agents (Data Consumers)**: Autonomous AI agents attempt to fetch API data from providers. The provider intercepts the request and responds with an `HTTP 402 Payment Required` L402 invoice.
3. **Soroban Stateless VM (Privacy Preserved)**: The agent responds by invoking the Soroban contract, submitting its ZK preimage to prove pool membership. Because the deposit was made into the pool via a hash commitment, the agent's identity and the treasury's master address remain masked from the public eye during the settlement.
4. **On-Chain Settlement**: The VM executes the hash-check against the cryptographic commitment. If verified, the contract auto-authorizes and releases XLM from the *Pool* to the Data Provider, explicitly masking the original funding source.
5. **API Authentication**: The agent uses the resulting Stellar transaction hash as an L402 bearer token to access the protected API endpoint.

---

## ⚙️ Technical Merit

### Dual-Path Resiliency (V1 / V2)

Aegis402 implements a **dual-protocol fallback architecture** to guarantee payment completion even when infrastructure conditions vary:

| Path | Protocol | When Used |
|------|----------|-----------|
| 🟢 **Standard V2** | `@stellar/mpp` (MPP SDK) | Primary path. Automated L402 resolution via the Stellar Money Protocol library. |
| 🛡️ **Aegis-Native V1** | Custom Soroban + Axios | Fallback path. Manual fetch → 402 intercept → contract invocation → L402 bearer token. |

The `payment_orchestrator.ts` tries V2 first. On any failure (network, scheme mismatch, SDK limitation), it **automatically falls back to V1** without user intervention. The Audit Log displays which path was used on every transaction with a visual indicator (`🟢` / `🛡️`).

### Real-Time StellarExpert Integration

Every Transaction Hash emitted in the Security & Payment Audit Log is rendered as a **clickable hyperlink** pointing directly to `stellar.expert/explorer/testnet/tx/<hash>`. This provides:

- **Instant on-chain verification** — judges and auditors can click and confirm the settlement is real.
- **Compliance-grade traceability** — every M2M payment is permanently anchored to the Stellar ledger.
- The success modal also contains a direct link to the on-chain reference for each session.

### Payment Firewall (Rate Limiting)

The admin dashboard provides per-agent **spending limit sliders**. If an agent attempts to spend beyond its allocated limit, the gateway blocks the transaction client-side **before** any Soroban invocation, preventing unnecessary network calls and protecting the Shielded Pool.

### AI Audit Layer (Gemini)

After each successful settlement, the **Aegis Auditor** (powered by `gemini-1.5-flash`) generates a one-sentence technical security log entry analyzing the transaction metadata. This demonstrates the integration of Generative AI into a Web3 payment compliance pipeline.

---

## 🚀 How to Run

### Requirements
- Node.js v19+
- A funded Stellar **Testnet** account (get XLM at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test))
- A deployed Aegis Pool Soroban contract (see `/contracts`)

### 1. Configure Environment
```bash
cp .env.example .env
# Fill in all keys in .env (see .env.example for descriptions)
```

### 2. Run API Provider
```bash
cd api_provider
npm install
node server.js
# → Listening on http://localhost:3001
```

### 3. Run Web Dashboard
Open a second terminal:
```bash
npm install
npm run dev
# → Open http://localhost:3000
```

### 4. Simulate a Transaction
1. Open the dashboard at `http://localhost:3000`
2. Adjust the **Fleet Limit Slider** for Alpha DataNode or Zeta Reasoner
3. Click **Simulate** — watch the full L402 flow in the Audit Log
4. Click the cyan hash link to verify the settlement on StellarExpert

---

## 📁 Project Structure

```
aegis402/
├── api_provider/       # Express server with L402 middleware (port 3001)
├── agent_client/       # Standalone Node.js agent consumer
├── contracts/          # Soroban smart contract (Rust)
│   └── aegis_pool/src/lib.rs
├── src/
│   ├── App.tsx                       # Main B2B Gateway dashboard UI
│   ├── services/
│   │   ├── payment_orchestrator.ts   # V1/V2 dual-path coordinator
│   │   ├── aegis_v1_custom.ts        # Custom L402 + Soroban flow (V1)
│   │   └── mpp_standard_v2.ts        # MPP SDK automated flow (V2)
│   └── vite-env.d.ts                 # TypeScript env type declarations
├── PITCH_SCRIPT.md     # Hackathon demo walkthrough
└── .env.example        # Environment variable reference
```

---

## 🔐 Security Notes

- **Never** use a mainnet Stellar key in `VITE_TREASURY_SECRET_KEY`. The Vite frontend bundles all `VITE_` variables into the JavaScript payload.
- The ZK commitment currently uses a mock preimage (`zk_signature_mock`). In production, this would be replaced with a real secret managed by the agent's secure enclave.
- The L402 token validation in `server.js` is currently local (no RPC call). In production, add a Horizon/RPC check to verify `txHash` against `PROVIDER_PUBLIC_KEY` on-chain.

---

*Built for the Stellar Hackathon 2025 · Powered by Soroban, L402, and Google Gemini*
