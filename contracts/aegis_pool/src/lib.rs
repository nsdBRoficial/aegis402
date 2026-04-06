#![no_std]
// Importa os módulos do Soroban SDK necessários para o contrato
// Imports required Soroban SDK modules for the contract
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env};

// Define as chaves de armazenamento persistente do contrato
// Defines persistent storage keys for the contract
#[contracttype]
pub enum DataKey {
    // Associa um hash de commitment (ZK) ao saldo correspondente no pool shielded
    // Associates a commitment hash (ZK) to the corresponding balance in the shielded pool
    Commitment(BytesN<32>),
}

#[contract]
pub struct AegisPool;

#[contractimpl]
impl AegisPool {
    /// Direciona depósitos corporativos sob M2M Commitment
    /// Routes corporate deposits under a M2M ZK Commitment
    ///
    /// PT-BR: O chamador (`from`) deve autorizar esta operação.
    /// O valor `commitment` é o hash SHA-256 do preimage secreto do agente.
    /// Isso garante que somente quem conhece o preimage pode retirar os fundos via `pay`.
    ///
    /// EN: The caller (`from`) must authorize this operation.
    /// The `commitment` value is the SHA-256 hash of the agent's secret preimage.
    /// This ensures only the holder of the preimage can withdraw funds via `pay`.
    pub fn deposit(env: Env, from: Address, token_address: Address, commitment: BytesN<32>, amount: i128) {
        // Requer autorização criptográfica do endereço `from` / Requires cryptographic auth from `from`
        from.require_auth();

        // Cria um cliente para o token SAC do XLM nativo / Creates a client for the native XLM SAC token
        let client = token::Client::new(&env, &token_address);
        
        // Transfere do tesouro corporativo para o pool shielded (este contrato)
        // Transfers from Corporate Treasury to the Shielded Pool (this contract)
        client.transfer(&from, &env.current_contract_address(), &amount);

        // Mapeia o saldo ao commitment criptográfico (acumulativo)
        // Maps the balance to the cryptographic commitment (cumulative)
        let key = DataKey::Commitment(commitment.clone());
        let mut balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        balance += amount;
        env.storage().persistent().set(&key, &balance);
    }

    /// Resolve liquidações offline via L402 ZK-Proof Hash
    /// Resolves offline settlements via L402 ZK-Proof Hash
    ///
    /// PT-BR: O agente revela o `secret` (preimage). O contrato recalcula o SHA-256,
    /// localiza o saldo no pool shielded e transfere o valor ao `provider`.
    /// Este é o mecanismo de liquidação nativa do Aegis402 — sem necessidade de
    /// custódia centralizada: a prova criptográfica é a autorização.
    ///
    /// EN: The agent reveals the `secret` (preimage). The contract recomputes SHA-256,
    /// locates the balance in the shielded pool, and transfers the amount to the `provider`.
    /// This is the Aegis402 native settlement mechanism — no centralized custody needed:
    /// the cryptographic proof IS the authorization.
    pub fn pay(env: Env, secret: BytesN<32>, provider: Address, token_address: Address, amount: i128) {
        // Reconstrói o commitment a partir do preimage secreto do agente
        // Reconstructs the commitment from the agent's secret preimage
        let bytes: soroban_sdk::Bytes = secret.into();
        let commitment = env.crypto().sha256(&bytes);

        // Localiza o saldo shielded associado a este commitment
        // Locates the shielded balance associated with this commitment
        let key = DataKey::Commitment(commitment);
        let mut balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        // Valida que o saldo do pool é suficiente para a liquidação
        // Validates that the pool balance is sufficient for settlement
        if balance < amount {
            panic!("Insufficient shielded secret balance");
        }
        
        // Cria cliente do token para operações de transferência
        // Creates token client for transfer operations
        let client = token::Client::new(&env, &token_address);
        
        // Estende o TTL para evitar expiração da instância e crash da WasmVM
        // Extends TTL to prevent instance expiration and WasmVM crash (UnreachableCodeReached)
        env.storage().instance().extend_ttl(100, 100);
        env.storage().persistent().extend_ttl(&key, 1000, 1000);
        
        // Fail-safe: verifica a liquidez nativa real do contrato antes de transferir
        // Fail-safe: verifies the contract's actual native liquidity before transferring
        let contract_balance = client.balance(&env.current_contract_address());
        if contract_balance < amount {
            panic!("Insufficient Contract native liquidity");
        }

        // Deduz do escrow persistente shielded / Deducts from the persistent shielded escrow
        balance -= amount;
        env.storage().persistent().set(&key, &balance);

        // Transfere o ativo ao provider (destinatário da liquidação L402)
        // Transfers the asset to the provider (L402 settlement recipient)
        client.transfer(&env.current_contract_address(), &provider, &amount);
    }
}
