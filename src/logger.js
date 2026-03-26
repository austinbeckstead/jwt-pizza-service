const config = require('./config');

class Logger {
  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  sqlLogger = (sql, params) => {    
    const logData = {
      sql: sql,
      params: params,
    };
    this.log('info', 'sql', logData);
  }

  factoryLogger = (body) => {
    const logData = {
      request: body,
    };
    this.log('info', 'factory', logData);
  }

  errorLogger = (error) => {
    const logData = {
      message: error.message,
      stack: error.stack,
    };
    this.log('error', 'application', logData);
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    // Mask password, token, apiKey, secret, key, and email fields
      logData = logData.replace(/"password":\s*"[^"]*"/gi, '"password": "*****"');
      logData = logData.replace(/"token":\s*"[^"]*"/gi, '"token": "*****"');
      logData = logData.replace(/"apiKey":\s*"[^"]*"/gi, '"apiKey": "*****"');
      logData = logData.replace(/"secret":\s*"[^"]*"/gi, '"secret": "*****"');
      logData = logData.replace(/"key":\s*"[^"]*"/gi, '"key": "*****"');
      logData = logData.replace(/"email":\s*"[^"]*"/gi, '"email": "*****"');
    return logData;
  }

  sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    fetch(`${config.logging.endpointUrl}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.accountId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}
module.exports = new Logger();