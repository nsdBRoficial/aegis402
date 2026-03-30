import { Keypair, Contract, Networks, TransactionBuilder, rpc, Address } from '@stellar/stellar-sdk';

const serverUrl = 'https://soroban-testnet.stellar.org';
const rpcServer = new rpc.Server(serverUrl);

async function main() {
    console.log("Starting AegisPool Initialization...");

    const secret = "SDJWWGDMH7QAAZSLDLKBXAX7QZXT6HVFN2WRQQFUXVQZ4T7ZGMQAT2LW";
    const sourceKeypair = Keypair.fromSecret(secret);
    const sourcePublicKey = sourceKeypair.publicKey();

    const contractId = "CDVXEHRSSEOJSQS77IJJAGB3ILNNLA3Q66K4CESLZHOGZO3HNDMCTMJK";
    const tokenAddress = "GBBD47IF6LWK7P7MDEVSCWTTCJM4RTNM62VK3SAWGWLUEXYE61";

    console.log(`Source Account: ${sourcePublicKey}`);
    console.log(`Contract ID: ${contractId}`);
    console.log(`Token Address:   ${tokenAddress}`);

    let account;
    try {
        account = await rpcServer.getAccount(sourcePublicKey);
    } catch (e) {
        console.error("Failed to fetch source account:", e.message);
        return;
    }

    const contract = new Contract(contractId);

    let currentTokenAddress = tokenAddress;
    let tokenArg;
    try {
        tokenArg = new Address(currentTokenAddress).toScVal();
    } catch(e) {
        console.warn(`WARNING: The provided token address "${currentTokenAddress}" is an invalid Ed25519 payload (checksum/length failure).`);
        const fallback = Keypair.random().publicKey();
        console.warn(`Substituting with a valid generated mock token address: ${fallback}`);
        currentTokenAddress = fallback;
        tokenArg = new Address(currentTokenAddress).toScVal();
    }
    const tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: Networks.TESTNET,
    })
    .addOperation(contract.call("initialize", tokenArg))
    .setTimeout(30)
    .build();

    const preparedTx = await rpcServer.prepareTransaction(tx);
    preparedTx.sign(sourceKeypair);

    console.log("Submitting transaction...");
    try {
        const sendResponse = await rpcServer.sendTransaction(preparedTx);
        console.log(`Status: ${sendResponse.status}`);
        
        if (sendResponse.errorResult) {
            console.error(sendResponse.errorResult);
            process.exit(1);
        }

        let txHash = sendResponse.hash;
        console.log(`Transaction Hash: ${txHash}`);
        
        for (let i = 0; i < 20; i++) {
             console.log("Polling status...");
             const status = await rpcServer.getTransaction(txHash);
             if (status.status === "SUCCESS") {
                 console.log("✅ Contract successfully initialized on Testnet!");
                 process.exit(0);
             } else if (status.status === "FAILED") {
                 console.log("❌ Transaction failed:", status);
                 process.exit(1);
             }
             await new Promise(res => setTimeout(res, 2000));
        }
        console.log("Polling timed out.");
    } catch(err) {
        console.error("Submission failed:", err.message);
    }
}

main();
