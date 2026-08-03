if (!process.env.DB_PATH) {
  process.env.DB_PATH = '/tmp/residence.db';
}

const { createApp, initializeDatabase } = require('../src/app');

const app = createApp();
let initPromise;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = undefined;
      throw error;
    });
  }

  return initPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureInitialized();
    return app(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Service initialization failed.' });
    return undefined;
  }
};
