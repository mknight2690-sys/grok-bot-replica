#!/usr/bin/env node
const bot = require('./bot.js');

const isCI = process.argv.includes('--ci-mode') || process.env.GITHUB_ACTIONS === 'true';

bot.init();

if (isCI) {
  console.log('=== Grok Bot 24/7 — GitHub Actions Mode ===');
  console.log(`Time: ${new Date().toISOString()}`);
  bot.runLoop().then(() => {
    console.log('Bot run complete.');
    process.exit(0);
  }).catch(err => {
    console.error('Bot error:', err.message);
    process.exit(1);
  });
} else {
  // Interactive CLI mode
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 Grok Bot CLI — type your message (or "exit" to quit)');
  console.log(`Model: ${bot.getModelInfo().model}`);

  readline.question('> ', async (input) => {
    if (input.trim().toLowerCase() === 'exit') {
      readline.close();
      process.exit(0);
    }
    const result = await bot.sendMessage(input);
    console.log(`\n[${result.model || 'fallback'}] ${result.response}\n`);
    readline.close();
  });
}