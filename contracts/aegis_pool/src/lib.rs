#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, BytesN, Env};

#[contracttype]
pub enum DataKey {
    Token,
    Commitment(BytesN<32>),
}

#[contract]
pub struct AegisPool;

#[contractimpl]
impl AegisPool {
    /// Inicializa o contrato com o endereço do token (ex: USDC)
    pub fn initialize(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Token) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Recebe depósitos da tesouraria e atrela o valor a um hash (commitment)
    pub fn deposit(env: Env, from: Address, commitment: BytesN<32>, amount: i128) {
        from.require_auth();

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // Transfere os tokens da carteira corporativa para o contrato (Pool)
        client.transfer(&from, &env.current_contract_address(), &amount);

        // Registra o saldo atrelado ao commitment
        let key = DataKey::Commitment(commitment.clone());
        let mut balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        balance += amount;
        env.storage().persistent().set(&key, &balance);
    }

    /// Autoriza o pagamento para um provedor revelando o secret original (Zero-Knowledge simplificado)
    pub fn pay(env: Env, secret: BytesN<32>, provider: Address, amount: i128) {
        // O hash do secret deve bater com o commitment armazenado
        let bytes: soroban_sdk::Bytes = secret.into();
        let commitment = env.crypto().sha256(&bytes);

        let key = DataKey::Commitment(commitment);
        let mut balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);

        if balance < amount {
            panic!("Insufficient shielded balance or invalid secret");
        }

        // Deduz o saldo do commitment
        balance -= amount;
        env.storage().persistent().set(&key, &balance);

        // Transfere os tokens do Pool para o Provedor da API
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &provider, &amount);
    }
}
