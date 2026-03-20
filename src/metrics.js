const os = require('os');
const config = require('./config');

let requestMethodCounts = {};
let userLastSeen = {};


function requestCountTracker(req, res, next) {
  requestMethodCounts[req.method] = (requestMethodCounts[req.method] || 0) + 1;
  requestMethodCounts['ALL'] = (requestMethodCounts['ALL'] || 0) + 1;
  next();
}

function updateLastSeen(req, res, next) {
    if (req.user && req.user.id) {
        userLastSeen[req.user.id] = Date.now();
    }
    next();
}

function removeUserLastSeen(id) {
    if (id) {
        delete userLastSeen[id];
    }
}

function buildRequestCountMetrics() {
  const metrics = [];

  const allMethods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  allMethods.forEach((method) => {
    const count = requestMethodCounts[method] || 0;
    metrics.push(createMetric('request_method_counts', count, '1', 'sum', 'asInt', { method }));
  });

  requestMethodCounts = {};
  return metrics;
}

function buildActiveUserMetrics() {
  const metrics = [];
  const now = Date.now();
  const activeWindow = 15 * 60 * 1000;
  let activeUsers = 0;
  Object.keys(userLastSeen).forEach(userId => {
    if (now - userLastSeen[userId] < activeWindow) {
      activeUsers += 1;
    } else {
      delete userLastSeen[userId];
    }
  });
  metrics.push(createMetric('active_users', activeUsers, '1', 'gauge', 'asInt', {}));
  return metrics;
}

function sendMetricsPeriodically(period) {
  const timer = setInterval(() => {
    try {
      console.log('sending metrics')
      const metrics = [];
      const requestCountMetrics = buildRequestCountMetrics();
      const activeUserMetrics = buildActiveUserMetrics();
      console.log('active users', activeUserMetrics);
      metrics.push(...requestCountMetrics);
      metrics.push(...activeUserMetrics);
      sendMetricToGrafana(metrics);
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  }, period);
}

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

module.exports = { requestCountTracker, sendMetricsPeriodically, updateLastSeen, removeUserLastSeen };