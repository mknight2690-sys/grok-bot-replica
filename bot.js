const axios = require('axios');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

const OPENROUTER_KEYS = [
  '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',
  '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',
  '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',
  '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'
];

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
  lastRun: null,
  totalRequests: 0,
  modelsTried: {},
  isActive: false
};

let keyIndex = 0;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
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
  const key = OPENROUTER_KEYS[keyIndex % OPENROUTER_KEYS.length];
  keyIndex++;
  return key;
}

function getModelInfo() {
  return {
    model: FREE_MODELS[0],
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

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const key = getNextKey();
    const model = FREE_MODELS[attempt % FREE_MODELS.length];

    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/mknight2690-sys/grok-bot-replica',
            'X-Title': 'Grok Bot 24/7'
          },
          timeout: 15000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        state.modelsTried[model] = (state.modelsTried[model] || 0) + 1;
        return {
          response: response.data.choices[0].message.content,
          model: model,
          provider: 'openrouter',
          success: true
        };
      }
    } catch (err) {
      const status = err.response?.status;
      console.error(`Attempt ${attempt + 1} failed (${model}):`, status || err.message);

      if (status === 401) {
        continue;
      }
      if (status === 429) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
    }
  }

  return {
    response: "Hmm, I'm having trouble connecting to my brain right now. All the free APIs seem to be napping. Try again later?",
    model: null,
    provider: null,
    success: false,
    error: 'All providers exhausted'
  };
}

async function sendMessage(message, ciMode = false) {
  loadState();
  state.conversation.push({ role: 'user', content: message, ts: Date.now() });

  const result = await callOpenRouter(message);

  if (result.success) {
    state.conversation.push({
      role: 'assistant',
      content: result.response,
      ts: Date.now(),
      model: result.model,
      provider: result.provider
    });
    state.totalRequests++;
  }

  state.lastRun = new Date().toISOString();
  state.isActive = true;
  saveState();

  return result;
}

async function runLoop() {
  state.isActive = true;
  state.lastRun = new Date().toISOString();
  saveState();

  console.log(`[${new Date().toISOString()}] Grok Bot 24/7 running (CI mode)`);
  console.log(`Conversation history: ${state.conversation.length} messages`);

  // Check for scheduled tasks / pings — in CI mode we just keep the bot "alive"
  // and process any queued prompts from state
  const pendingPrompts = state.conversation
    .filter(m => m.role === 'user' && !m.processed)
    .slice(-1);

  for (const msg of pendingPrompts) {
    const result = await callOpenRouter(msg.content);
    msg.processed = true;
    state.conversation.push({
      role: 'assistant',
      content: result.response,
      ts: Date.now(),
      model: result.model
    });
    state.totalRequests++;
  }

  // Ping: send a health-check message to keep models active
  const healthCheck = await callOpenRouter('Quick ping — respond with "Bot alive!" and the current model.');
  console.log(`Health check: ${healthCheck.response?.substring(0, 100)}`);

  saveState();
  state.isActive = false;
  saveState();

  console.log(`[${new Date().toISOString()}] Bot run complete. Total requests: ${state.totalRequests}`);
}

function init() {
  loadState();
}

function shutdown() {
  state.isActive = false;
  saveState();
}

module.exports = {
  init,
  shutdown,
  runLoop,
  sendMessage,
  getModelInfo,
  loadState,
  saveState
};