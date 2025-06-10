import chalk from "chalk";
import { Client, convertStringToHex, Payment, Wallet, xrpToDrops } from "xrpl";

export async function axelar() {
    console.log(chalk.bgWhite("-- AXELAR BRIGE --"));

    // DEVNET: wss://s.devnet.rippletest.net:51233/
    // TESTNET: wss://s.altnet.rippletest.net:51233/
    const client = new Client("wss://s.altnet.rippletest.net:51233/");
    await client.connect();

    console.log("Connected to the XRPL TESTNET");

    const { wallet, balance } = await client.fundWallet();
    console.log(chalk.bgWhite(`Main wallet address: ${wallet.classicAddress} - Balance: ${balance} - SEED: ${wallet.seed}`)); // sEd7VHovMRHRFdeER5Ucw5tNvSHysAP

    const paymentTx: Payment = {
        TransactionType: "Payment",
        Account: wallet.classicAddress,
        Destination: "rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2",
        // Relayer Addresses
        // DEVNET: rGAbJZEzU6WaYv5y1LfyN7LBBcQJ3TxsKC
        // TESTNET: rNrjh1KGZk2jBR3wPfAQnoidtFFYQKbQn2
        // MAINNET: rfmS3zqrQrka8wVyhXifEeyTwe8AMz2Yhw // Multisig
        Amount: xrpToDrops(99),
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
                    MemoData: convertStringToHex("1700000") // not required for devnet, 1700000 for testnet and 3000000 for the SUIDROUTER tx on the TESTNET and ? for mainnet
                }
            },
            {
                Memo: {
                    MemoType: convertStringToHex("payload"), // for SQUIDROUTER on the testnet
                    // my address in an unknown format, followed by something --- SETUP YOUR ADDRESS
                    MemoData: "000000000000000000000000FF8FB48E90161803BA7B878DF88970ABEF0CB5D51253554E1F155532C2644E9E6045D95CBD3BF2C3E1A6B258BEE257B99123C194"
                }
            },
        ]
    }

    const tx = await client.submitAndWait(paymentTx, { autofill: true, wallet });

    if (tx.result.validated) {
        console.log(chalk.bgGreen(`✅ Transaction successful! Transaction hash: ${tx.result.hash}`));
    } else {
        console.log(chalk.bgRed(`❌ Transaction failed! Error: ${tx.result.meta}`));
    }

    await client.disconnect();
}