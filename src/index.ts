import chalk from 'chalk';
import readline from 'readline';

import { axelar } from './axelar';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function menu() {
    console.log('\nChoose a bridge to run:');
    console.log(`  ${chalk.grey('1 - Axelar')}`);
    console.log('  0 - Exit\n');
}

async function handleChoice(choice: string) {
    switch (choice.trim()) {
        case '1':
            await axelar();
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
