const os = require('os');
const config = require('./config');

let requestMethodCounts = {};
let userLastSeen = {};
let authenticationSuccesses = 0;
let authenticationFailures = 0;
let pizzasSold = 0;
let pizzaFailures = 0;
let revenue = 0.0;
let latencyCount = 0;
let totalLatency = 0;
let pizzaLatencyCount = 0;
let totalPizzaLatency = 0;


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

function authenticationAttemptTracker(success) {
    if (success) {
        authenticationSuccesses += 1;
    } else {
        authenticationFailures += 1;
    }
}

function pizzaOrderTracker(success, amount) {
    if (success) {
        pizzasSold += 1;
        revenue += amount;
    } else {
        pizzaFailures += 1;
    }
}

function pizzaLatencyTracker(duration) {
    pizzaLatencyCount += 1;
    totalPizzaLatency += duration;
}

function latencyTracker(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000;
    latencyCount += 1;
    totalLatency += duration;
  });
  next();
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

function buildAuthenticationAttemptMetrics() {
    const metrics = [];
    metrics.push(createMetric('authentication_successes', authenticationSuccesses, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('authentication_failures', authenticationFailures, '1', 'sum', 'asInt', {}));
    authenticationSuccesses = 0;
    authenticationFailures = 0;
    return metrics;
}

function buildCpuAndMemoryMetrics() {
  const metrics = [];
  const cpuUsage = getCpuUsagePercentage();
  const memoryUsage = getMemoryUsagePercentage();
  metrics.push(createMetric('cpu_usage_percentage', cpuUsage, 'percent', 'gauge', 'asDouble', {}));
  metrics.push(createMetric('memory_usage_percentage', memoryUsage, 'percent', 'gauge', 'asDouble', {}));
  return metrics;
}

function buildPizzaOrderMetrics() {
    const metrics = [];
    metrics.push(createMetric('pizzas_sold', pizzasSold, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('pizza_failures', pizzaFailures, '1', 'sum', 'asInt', {}));
    metrics.push(createMetric('revenue', revenue, 'BTC', 'sum', 'asDouble', {}));
    pizzasSold = 0;
    pizzaFailures = 0;
    revenue = 0.0;
    return metrics;
}

function buildLatencyMetrics() {
    const metrics = [];
    const averageLatency = latencyCount > 0 ? totalLatency / latencyCount : 0;
    metrics.push(createMetric('average_latency_ms', averageLatency, 'ms', 'gauge', 'asDouble', {}));
    latencyCount = 0;
    totalLatency = 0;
    return metrics;
}

function buildPizzaLatencyMetrics() {
    const metrics = [];
    const averagePizzaLatency = pizzaLatencyCount > 0 ? totalPizzaLatency / pizzaLatencyCount : 0;
    metrics.push(createMetric('average_pizza_latency_ms', averagePizzaLatency, 'ms', 'gauge', 'asDouble', {}));
    pizzaLatencyCount = 0;
    totalPizzaLatency = 0;
    return metrics;
}

function sendMetricsPeriodically(period) {
  setInterval(() => {
    try {
      console.log('sending metrics')
      const metrics = [];
      const requestCountMetrics = buildRequestCountMetrics();
      const activeUserMetrics = buildActiveUserMetrics();
      const authenticationAttemptMetrics = buildAuthenticationAttemptMetrics();
      const cpuAndMemoryMetrics = buildCpuAndMemoryMetrics();
      const pizzaOrderMetrics = buildPizzaOrderMetrics();
      const latencyMetrics = buildLatencyMetrics();
      const pizzaLatencyMetrics = buildPizzaLatencyMetrics();
      metrics.push(...requestCountMetrics);
      metrics.push(...activeUserMetrics);
      metrics.push(...authenticationAttemptMetrics);
      metrics.push(...cpuAndMemoryMetrics);
      metrics.push(...pizzaOrderMetrics);
      metrics.push(...latencyMetrics);
      metrics.push(...pizzaLatencyMetrics);
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

module.exports = { requestCountTracker, sendMetricsPeriodically, updateLastSeen, removeUserLastSeen, authenticationAttemptTracker, pizzaOrderTracker, latencyTracker, pizzaLatencyTracker };