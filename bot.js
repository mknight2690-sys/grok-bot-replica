const axios = require('axios');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

const FALLBACK_KEYS = [
  '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',
  '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',
  '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',
  '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',
];

const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || '').split(',').filter(k => k.startsWith('sk-or-v1-'));
if (OPENROUTER_KEYS.length === 0) {
  FALLBACK_KEYS.forEach(k => OPENROUTER_KEYS.push(k));
}

const FREE_MODELS = [
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-20b:free',
  'qwen/qwen3.8-27b:free',
  'liquid/lfm-2.5-2.6b:free',
];

const SYSTEM_PROMPT = `You are Grok, a highly opinionated and sassy AI assistant created by xAI. Be witty, sarcastic, and unapologetically honest. Don't be a robot. Answer directly with personality.`;

let state = {
  conversation: [],
  keyIndex: 0,
  modelIndex: 0,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load state:', e.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to save state:', e.message);
  }
}

function getNextKey() {
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error('No OpenRouter API keys found. Set OPENROUTER_KEYS env var.');
  }
  const key = OPENROUTER_KEYS[state.keyIndex % OPENROUTER_KEYS.length];
  state.keyIndex++;
  saveState();
  return key;
}

function getModelInfo() {
  return {
    model: FREE_MODELS[state.modelIndex % FREE_MODELS.length],
    provider: 'openrouter',
    free: true,
    keysAvailable: OPENROUTER_KEYS.length
  };
}

async function callOpenRouter(prompt, maxRetries = 3) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt }
  ];

  for (let i = 0; i < maxRetries; i++) {
    try {
      const key = getNextKey();
      const modelInfo = getModelInfo();

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelInfo.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://github.com/mknight2690-sys/grok-bot-replica',
            'X-Title': 'Grok Bot 24/7'
          }
        }
      );

      // Rotate to next model for variety
      state.modelIndex++;
      saveState();

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

function init() {
  loadState();
  console.log('Grok Bot 24/7 is starting...');
  console.log(`Available API keys: ${OPENROUTER_KEYS.length}`);
  console.log(`Free models: ${FREE_MODELS.join(', ')}`);

  if (OPENROUTER_KEYS.length === 0) {
    console.error('No API keys configured. Set OPENROUTER_KEYS environment variable.');
  }
}

function shutdown() {
  saveState();
}

async function sendMessage(message) {
  const response = await callOpenRouter(message);
  const modelInfo = getModelInfo();
  return { model: modelInfo.model, response };
}

async function runLoop() {
  loadState();

  const testPrompts = [
    'Say hello in a witty, sarcastic way as Grok would.',
    'Tell me a joke about AI.',
    'Explain quantum computing in simple terms.'
  ];

  for (const prompt of testPrompts) {
    try {
      const result = await sendMessage(prompt);
      console.log(`[${result.model}] ${result.response}`);
      state.requestCount = (state.requestCount || 0) + 1;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Request failed:', error.message);
    }
  }

  saveState();
}

async function run() {
  init();

  try {
    const response = await callOpenRouter('Say hello in a witty, sarcastic way as Grok would.');
    console.log('Grok says:', response);
  } catch (error) {
    console.error('Failed to get response from OpenRouter:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { callOpenRouter, getNextKey, getModelInfo, init, shutdown, sendMessage, runLoop };