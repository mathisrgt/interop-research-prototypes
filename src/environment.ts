import dotenv from 'dotenv';

dotenv.config();

if (process.env.EVM_WALLET_PRIVATE_KEY === undefined)
    throw new Error('EVM_WALLET_PRIVATE_KEY is undefined');
export const EVM_WALLET_PRIVATE_KEY = process.env.EVM_WALLET_PRIVATE_KEY;