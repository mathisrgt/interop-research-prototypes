import chalk from "chalk";
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xrplevmTestnet } from "viem/chains";
import { Client, convertStringToHex, Payment, xrpToDrops } from "xrpl";
import { EVM_WALLET_PRIVATE_KEY } from "./environment";

export async function axelarXrplToEvm() {
    console.log(chalk.bgWhite(`\n-- AXELAR BRIGE ${chalk.bgBlue("XRPL -> EVM")} --`));

    // DEVNET: wss://s.devnet.rippletest.net:51233/
    // TESTNET: wss://s.altnet.rippletest.net:51233/
    const client = new Client("wss://s.altnet.rippletest.net:51233/");
    await client.connect();

    const publicClient = createPublicClient({
        chain: xrplevmTestnet,
        transport: http(),
    });

    const { wallet: xrplWallet, balance: initXrplBalance } = await client.fundWallet();

    const evmWallet = privateKeyToAccount(`0x${EVM_WALLET_PRIVATE_KEY}`);
    const initEvmWalletBalance = await publicClient.getBalance({ address: evmWallet.address });

    console.log(chalk.bgRed(`Initial settings`));
    console.log(`XRPL wallet: ${xrplWallet.classicAddress} - Balance: ${initXrplBalance} XRP - SEED: ${xrplWallet.seed}`); // sEd7VHovMRHRFdeER5Ucw5tNvSHysAP
    console.log(`XRPL EVM wallet: ${evmWallet.address} - Balance: ${formatEther(initEvmWalletBalance)} XRP`);

    const paymentTx: Payment = {
        TransactionType: "Payment",
        Account: xrplWallet.classicAddress,
        Destination: "rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2",
        // Relayer Addresses
        // DEVNET: rGAbJZEzU6WaYv5y1LfyN7LBBcQJ3TxsKC
        // TESTNET: rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2
        // MAINNET: rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw // Multisig
        Amount: xrpToDrops(8),
        Memos: [
            {
                Memo: {
                    MemoType: convertStringToHex("type"), // for testnet and mainnet
                    MemoData: convertStringToHex("interchain_transfer") // for testnet and mainnet
                }
            },
            {
                Memo: {
                    MemoType: convertStringToHex("destination_address"),
                    MemoData: convertStringToHex("9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58")
                    // 0xfF8FB48e90161803BA7b878dF88970abEf0cb5D5 - MY ADDRESS
                    // 9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58 - SQUIDROUTER CONTRACT
                }
            },
            {
                Memo: {
                    MemoType: convertStringToHex("destination_chain"),
                    MemoData: convertStringToHex("xrpl-evm") // "xrpl-evm-devnet" for the devnet, "xrpl-evm" for testnet and ? for mainnet
                }
            },
            {
                Memo: {
                    MemoType: convertStringToHex("gas_fee_amount"), // for testnet
                    MemoData: convertStringToHex("3000000") // not required for devnet, 1700000 for testnet and 3000000 for the SUIDROUTER tx on the TESTNET and ? for mainnet
                }
            },
            {
                Memo: {
                    MemoType: convertStringToHex("payload"), // for SQUIDROUTER on the testnet
                    // my address in an unknown format, followed by something --- SETUP YOUR ADDRESS
                    // 000000000000000000000000FF8FB48E90161803BA7B878DF88970ABEF0CB5D51253554E1F155532C2644E9E6045D95CBD3BF2C3E1A6B258BEE257B99123C194
                    // 0000000000000000000000009050B2B1EB70458D93DA54028B2A773A5E63615DDBCDB69389FDCFAA33F19A0356C8A1A764C43B63B60FE098C02CE5EAAC4AFBAC
                    MemoData: "000000000000000000000000A43F293D412856F5EBE3A6B49D41654A18CF93A4752527D865722525ADCEDE9E00875DE3DEBC6EB4C885D2B4482F5F2C118D815F"
                }
            },
        ]
    }

    const startTime = Date.now();
    const tx = await client.submitAndWait(paymentTx, { autofill: true, wallet: xrplWallet });

    if (tx.result.validated) {
        console.log(chalk.bgGreen(`✅ Transaction successful! Transaction hash: ${tx.result.hash}`));
    } else {
        console.log(chalk.bgRed(`❌ Transaction failed! Error: ${tx.result.meta}`));
    }

    const contractAddress = "0x9bEb991eDdF92528E6342Ec5f7B0846C24cbaB58"; // SQUIDROUTER CONTRACT ADDRESS
    const blockscoutUrl = `https://explorer.testnet.xrplevm.org/api/v2/addresses/${evmWallet.address}/token-transfers?filter=to`;

    let notFound = true;

    console.log(`⏳ Waiting 90 seconds for the transaction to be confirmed...`);
    await new Promise(resolve => setTimeout(resolve, 90_000));

    while (notFound) {
        try {
            const response = await fetch(blockscoutUrl, {
                method: "GET",
                headers: {
                    "accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();

            const currentBlockNbBg = await publicClient.getBlockNumber();
            const currentBlockNb = Number(currentBlockNbBg);

            data.items.reverse().forEach((tx: any, i: number) => {
                console.log(`\n${chalk.bgBlue(`${i + 1}.`)} Hash: ${tx.transaction_hash} | From: ${tx.from.hash}`);

                console.log(chalk.bgBlue(`\nBlock number`));
                console.log(`Transaction: ${tx.block_number}`);
                console.log(`Current: ${currentBlockNb}`);

                console.log(chalk.bgBlue(`\nCondition matching`));
                console.log(`Sender: ${tx.from.hash === contractAddress ? '✅' : '❌'}`);
                console.log(`Timeframe (< 3 min): ${tx.block_number > currentBlockNb - 30 ? '✅' : '❌'}`);

                if (tx.from.hash === contractAddress && tx.block_number > currentBlockNb - 50) {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    const elapsedTimeFormatted = `${minutes}m ${seconds}s`;

                    console.log(chalk.bgGreen(`\n✅✅ Transaction found matching ${formatEther(tx.total.value)} XRP payment!`));
                    console.log(`⏱ Received after ${elapsedTimeFormatted}`);

                    notFound = false;
                }
            });

            if (notFound) {
                console.log(`\n⏳ Retrying in 1 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 1_000));
            }
        } catch (error) {
            console.error("❌ Failed to fetch transactions:", error);
        }
    }

    console.log(`⏳ Waiting 20 seconds for return gas tx...`);
    await new Promise(resolve => setTimeout(resolve, 20_000));

    const finalEvmWalletBalance = await publicClient.getBalance({ address: evmWallet.address });
    const finalXrplWalletBalance = await client.getXrpBalance(xrplWallet.classicAddress);

    console.log(`XRPL wallet balance ${finalXrplWalletBalance} XRP`);
    console.log(`EVM wallet balance ${formatEther(finalEvmWalletBalance)} XRP`);
    console.log(`Bridging overall cost: ${initXrplBalance - Number(formatEther(finalEvmWalletBalance))} XRP`);

    await client.disconnect();
}