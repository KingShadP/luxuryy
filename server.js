require('dotenv').config();

const { createApp, initializeDatabase } = require('./src/app');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const app = createApp();

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Residence server listening on port ${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
