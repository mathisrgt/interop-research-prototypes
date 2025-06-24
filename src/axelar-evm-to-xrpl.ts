import chalk from "chalk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xrplevmTestnet } from "viem/chains";
import { EVM_WALLET_PRIVATE_KEY } from "./environment";
import { AccountTxTransaction, Client, dropsToXrp, Transaction } from "xrpl";

export async function axelarEvmToXrpl() {
    console.log(chalk.bgWhite(`-- AXELAR BRIGE ${chalk.bgBlue("EVM -> XRPL")} --`));
    let startTime = Date.now();

    const publicClient = createPublicClient({
        chain: xrplevmTestnet,
        transport: http(),
    });

    const walletClient = createWalletClient({
        chain: xrplevmTestnet,
        transport: http()
    });

    const account = privateKeyToAccount(`0x${EVM_WALLET_PRIVATE_KEY}`);
    try {
        startTime = Date.now();
        const hash = await walletClient.writeContract({
            account,
            address: "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C",
            abi: [{
                "inputs": [
                    {
                        "internalType": "bytes32",
                        "name": "tokenId",
                        "type": "bytes32"
                    },
                    {
                        "internalType": "string",
                        "name": "destinationChain",
                        "type": "string"
                    },
                    {
                        "internalType": "bytes",
                        "name": "destinationAddress",
                        "type": "bytes"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    },
                    {
                        "internalType": "bytes",
                        "name": "metadata",
                        "type": "bytes"
                    },
                    {
                        "internalType": "uint256",
                        "name": "gasValue",
                        "type": "uint256"
                    }
                ],
                "name": "interchainTransfer",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }],
            functionName: "interchainTransfer",
            args: [
                "0xba5a21ca88ef6bba2bfff5088994f90e1077e2a1cc3dcc38bd261f00fce2824f",
                "xrpl",
                "0x724458747763574234676851687244614345796e656d57794c714850446d6f314b74",
                10000000000000000000n,
                "0x",
                500000000000000000n,
            ],
            value: 0n
        });

        console.log(chalk.bgWhite(`✅ Transaction submitted: ${hash}`));

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("✅ Transaction confirmed in block", receipt.blockNumber);
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const elapsedTimeFormatted = `${minutes}m ${seconds}s`;
        console.log(`⏱ Confirmed on the EVM after ${elapsedTimeFormatted}`);
    } catch (error) {
        console.error(chalk.red("❌ Transaction error:"));
        console.error(error);
    }

    const client = new Client("wss://s.altnet.rippletest.net:51233/");
    await client.connect();

    console.log("Connected to the XRPL TESTNET");

    console.log("🔄 Waiting for 100 seconds to allow the transaction to be processed...");
    await new Promise(resolve => setTimeout(resolve, 100_000));

    const RECIPIENT = "rDXtwcWB4ghQhrDaCEynemWyLqHPDmo1Kt";
    const AMOUNT_XRP = 10;
    const TIME_WINDOW_MINUTES = 5;

    while (true) {
        const ledgerResponse = await client.request({ command: "ledger_closed" });
        const latestLedger = ledgerResponse.result.ledger_index - 1;

        const ledgersBack = Math.floor((TIME_WINDOW_MINUTES * 60) / 4);
        const minLedger = latestLedger - ledgersBack;

        console.log(`🔍 Checking payments from ledger ${minLedger} to ${latestLedger}...`);

        const txs = await client.request({
            command: "account_tx",
            account: RECIPIENT,
            ledger_index_min: minLedger,
            ledger_index_max: latestLedger,
            binary: false,
            limit: 100,
        });

        console.log('Transactions:', txs);
        const matches = txs.result.transactions.filter((tx: AccountTxTransaction) => {
            console.log('Transaction:', tx);
            if (tx.tx !== undefined) {
                const transactionData = tx.tx as Transaction;
                console.log('Transaction Data:', transactionData);
                return (
                    transactionData.TransactionType === "Payment" &&
                    transactionData.Destination === RECIPIENT &&
                    dropsToXrp(transactionData.Amount as string) === AMOUNT_XRP
                );
            }
        });

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const elapsedTimeFormatted = `${minutes}m ${seconds}s`;

        if (matches.length > 0) {
            console.log(`✅ Transaction found matching 10 XRP payment!`);
            console.log(`⏱ Received after ${elapsedTimeFormatted}`);
            break;
        } else {
            console.log(`❌ No 10 XRP payments received in the last 5 minutes. Elapsed time: ${elapsedTimeFormatted}. Retrying in 1 second...`);
        }

        await new Promise(resolve => setTimeout(resolve, 1_000));
    }

}