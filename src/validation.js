const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeText(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function validateSubmission(input = {}) {
  const name = sanitizeText(input.name);
  const email = sanitizeText(input.email).toLowerCase();
  const interests = Array.isArray(input.interests)
    ? input.interests.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 12)
    : [];

  if (!name || name.length < 2 || name.length > 120) {
    throw new Error('Name must be between 2 and 120 characters.');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('A valid email address is required.');
  }

  return { name, email, interests };
}

function validatePrompt(input = {}) {
  const prompt = sanitizeText(input.prompt);
  const highThinking = Boolean(input.highThinking);

  if (!prompt || prompt.length < 3 || prompt.length > 2000) {
    throw new Error('Prompt must be between 3 and 2000 characters.');
  }

  return {
    prompt,
    highThinking,
    sessionId: sanitizeText(input.sessionId).slice(0, 80) || null,
  };
}

module.exports = {
  sanitizeText,
  validateSubmission,
  validatePrompt,
};
