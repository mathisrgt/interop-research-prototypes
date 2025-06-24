import chalk from "chalk";
import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xrplevmTestnet } from "viem/chains";
import { EVM_WALLET_PRIVATE_KEY, XRPL_WALLET_ADDRESS } from "./environment";
import { AccountTxTransaction, Client, dropsToXrp, Payment, Transaction, TransactionAndMetadata, TransactionMetadata, xrpToDrops } from "xrpl";

export async function axelarEvmToXrpl() {
    console.log(chalk.bgWhite(`-- AXELAR BRIGE ${chalk.bgBlue("EVM -> XRPL")} --`));

    const client = new Client("wss://s.altnet.rippletest.net:51233/");
    await client.connect();

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

    const evmWallet = privateKeyToAccount(`0x${EVM_WALLET_PRIVATE_KEY}`);
    const initEvmWalletBalance = await publicClient.getBalance({ address: evmWallet.address });
    const initXrplWalletBalance = await client.getXrpBalance(XRPL_WALLET_ADDRESS);

    console.log(chalk.bgRed(`\nInitial settings`));
    console.log(`XRPL wallet: ${XRPL_WALLET_ADDRESS} - Balance: ${initXrplWalletBalance} XRP`);
    console.log(`XRPL EVM wallet: ${evmWallet.address} - Balance: ${formatEther(initEvmWalletBalance)} XRP`);

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
                "0x72475975465771536a466661523237636f654e386378614375657668724e4c624345",
                4000000000000000000n,
                "0x",
                500000000000000000n,
            ],
            value: 0n
        });

        console.log(chalk.bgWhite(`✅ Transaction submitted: ${hash}`));

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(chalk.bgGreen("✅ Transaction confirmed in block", receipt.blockNumber));

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const elapsedTimeFormatted = `${minutes}m ${seconds}s`;
        console.log(`⏱ Confirmed on the EVM after ${elapsedTimeFormatted}`);
    } catch (error) {
        console.error(chalk.red("❌ Transaction error:"));
        console.error(error);
    }

    console.log("🔄 Waiting for 90 seconds to allow the transaction to be processed...");
    await new Promise(resolve => setTimeout(resolve, 90_000));

    const TIME_WINDOW_MINUTES = 3;

    while (true) {
        const ledgerResponse = await client.request({ command: "ledger_closed" });
        const latestLedger = ledgerResponse.result.ledger_index - 1;

        const ledgersBack = Math.floor((TIME_WINDOW_MINUTES * 60) / 4);
        const minLedger = latestLedger - ledgersBack;

        console.log(`🔍 Checking payments from ledger ${minLedger} to ${latestLedger}...`);

        const txs = await client.request({
            command: "account_tx",
            account: XRPL_WALLET_ADDRESS,
            ledger_index_min: minLedger,
            ledger_index_max: latestLedger,
            binary: false,
            limit: 100,
        });


        const matches = txs.result.transactions.filter((tx: AccountTxTransaction) => {
            if(tx.tx_json?.TransactionType === "Payment") console.log('Transaction account: ', (tx.tx_json.Destination === XRPL_WALLET_ADDRESS))
            
            console.log('Transaction: ', tx.tx_json);

            if (tx.tx_json) {
                return (
                    tx.tx_json.TransactionType === "Payment" &&
                    tx.tx_json.Destination === XRPL_WALLET_ADDRESS
                    // tx.tx_json.Account === "rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2" // Axelar multisig address on the Testnet
                    // dropsToXrp(Number((matches[0].meta.delivered_amount))
                );
            }
        });

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const elapsedTimeFormatted = `${minutes}m ${seconds}s`;

        if (matches.length > 0) {
            console.log(`✅ Transaction found matching ${dropsToXrp(Number((matches[0].meta as TransactionMetadata).delivered_amount))} XRP payment!`);
            console.log(`⏱ Received after ${elapsedTimeFormatted}`);
            break;
        } else {
            console.log(`❌ No payment received in the last ${TIME_WINDOW_MINUTES} minutes. Elapsed time: ${elapsedTimeFormatted}. Retrying in 1 second...`);
        }

        await new Promise(resolve => setTimeout(resolve, 1_000));
    }

    console.log(`⏳ Waiting 20 seconds for return gas tx...`);
    await new Promise(resolve => setTimeout(resolve, 20_000));

    const finalEvmWalletBalance = await publicClient.getBalance({ address: evmWallet.address });
    const finalXrplWalletBalance = await client.getXrpBalance(XRPL_WALLET_ADDRESS);

    console.log(`XRPL wallet balance ${finalXrplWalletBalance} XRP`);
    console.log(`EVM wallet balance ${formatEther(finalEvmWalletBalance)} XRP`);
    console.log(`Bridging overall cost: ${initXrplWalletBalance - Number(formatEther(finalEvmWalletBalance))} XRP`);

    await client.disconnect();
}