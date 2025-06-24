import chalk from 'chalk';
import readline from 'readline';

import { axelarXrplToEvm } from './axelar-xrpl-to-evm';
import { axelarEvmToXrpl } from './axelar-evm-to-xrpl';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function menu() {
    console.log('\nChoose a bridge to run:\n');
    console.log(`  ${chalk.bgWhite('Axelar Network')}`);
    console.log(`  ${chalk.white('1 - (XRP) XRPL ➡️ XRPL EVM')}`);
    console.log(`  ${chalk.white('2 - (XRP) XRPL EVM ➡️ XRPL')}`);
    console.log('');
    console.log(`  ${chalk.bgMagenta('Flare Network')}`);
    console.log(`  ${chalk.magenta('3 - (XRP - FXRP) XRPL ➡️ Songbird')}`);
    console.log('\n0 - Exit\n');
}

async function handleChoice(choice: string) {
    switch (choice.trim()) {
        case '1':
            await axelarXrplToEvm();
            break;
        case '2':
            await axelarEvmToXrpl();
            break;
        case '3':
            console.log('Not supported yet.');
            break;
        case '0':
            console.log('Bye!');
            process.exit(0);
        default:
            console.log(chalk.red('Invalid choice, please try again.\n'));
    }
}

async function main() {
    console.log(chalk.bgWhite.black(' Welcome to the tests and prototypes implementations environment!'));
    
    while (true) {
        menu();
        const answer = await new Promise<string>((resolve) => rl.question('Enter the number of your choice: ', resolve));
        await handleChoice(answer);
    }
}

main().catch((err) => {
    console.error(chalk.red('Unexpected error: '), err);
    rl.close();
});
