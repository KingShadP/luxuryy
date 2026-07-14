const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const HIGH_THINKING_BUDGET = Number.parseInt(process.env.GEMINI_HIGH_THINKING_BUDGET || '3072', 10);

function buildContents(messages, prompt) {
  const contentMessages = messages
    .slice(-8)
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  contentMessages.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  return contentMessages;
}

async function generateIntelligence({ messages, prompt, highThinking }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Set GEMINI_API_KEY.');
  }

  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: 'You are the Residence Intelligence for KingShadP. Keep responses premium, concise, and actionable.' }],
    },
    contents: buildContents(messages, prompt),
    generationConfig: {
      temperature: highThinking ? 0.45 : 0.7,
      maxOutputTokens: highThinking ? 1400 : 700,
    },
  };

  if (highThinking) {
    body.generationConfig.thinkingConfig = {
      thinkingBudget: Number.isNaN(HIGH_THINKING_BUDGET) ? 3072 : HIGH_THINKING_BUDGET,
      includeThoughts: false,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || 'Gemini request failed.';
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

module.exports = {
  generateIntelligence,
};
