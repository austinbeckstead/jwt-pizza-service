const app = require('./service.js');
const metrics = require('./metrics.js');
const logger = require('./logger.js');

const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

process.on('uncaughtException', (error) => {
  logger.errorLogger(error);
});

metrics.sendMetricsPeriodically(60000);