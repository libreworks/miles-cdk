const https = require("https");
const dns = require("dns");

const DNS_LOOKUP_ERR = "DNS lookup timeout";
const SOCKET_TIMEOUT_ERR = "Socket timeout";
const TLS_ERROR_CODES = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
]);
const SOCKET_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNTIMEOUT",
]);

/**
 * Creates a more informative error payload.
 *
 * @param {Error} error - The error encountered.
 * @return {Object} - The response payload.
 */
const createErrorPayload = (error) => {
  let cause = undefined;
  if (
    error.message.startsWith("getaddrinfo ENOTFOUND") ||
    error.message === DNS_LOOKUP_ERR
  ) {
    cause = "dns";
  } else if (TLS_ERROR_CODES.has(error.code)) {
    cause = "tls";
  } else if (SOCKET_ERROR_CODES.has(error.code)) {
    cause = "abort";
  }
  return {
    success: false,
    cause: cause,
    errorType: error.name,
    errorCode: error.code,
    errorMessage: error.message,
  };
};

/**
 * A simple wrapper around `dns.lookup`.
 *
 * @param {string} hostname -
 * @param {number|Object} options -
 * @param {Function} callback -
 */
const lookupOrTimeout = (hostname, options, callback) => {
  let called = false;
  let timeout = undefined;

  const doCallback = (err, address, family) => {
    if (called) {
      return;
    }
    called = true;
    clearTimeout(timeout);
    callback(err, address, family);
  };

  timeout = setTimeout(() => {
    doCallback(new Error(DNS_LOOKUP_ERR), null, null);
  }, 1000);

  dns.lookup(hostname, options, doCallback);
};

/**
 * Converts results from `process.hrtime` to milliseconds.
 *
 * @param {Array} times - array containing seconds and nano-seconds.
 * @param {number} times.0 - seconds
 * @param {number} times.1 - nanoseconds
 * @return {Array} - First item is seconds, second item is milliseconds.
 */
const toMillis = ([sec, nsec]) => [sec, nsec * 1e-6];

/**
 * The actual Lambda handler.
 *
 * @param {Object} event - The event payload.
 * @param {Object} context - The Lambda context.
 * @returns {Promise} - The invocation results.
 */
exports.handler = async function (event, context) {
  const options = {
    hostname: "example.com",
    port: 443,
    path: "/",
    method: "GET",
    timeout: 2000,
    lookup: lookupOrTimeout,
  };

  const promise = new Promise((resolve, reject) => {
    let results = { success: true };
    const startTime = process.hrtime();
    const req = https.request(options, (res) => {
      results.status = res.statusCode;
      results.latency = toMillis(process.hrtime(startTime));
      let body = [];
      res.on("data", (chunk) => {
        body.push(chunk);
      });
      res.on("end", () => {
        results.body = Buffer.concat(body).toString();
      });
    });

    req.on("timeout", () => {
      const err = new Error(SOCKET_TIMEOUT_ERR);
      err.code = "ECONNTIMEOUT";
      req.destroy(err);
    });

    req.on("error", (error) => {
      Object.assign(results, createErrorPayload(error));
    });

    req.on("close", () => {
      results.duration = toMillis(process.hrtime(startTime));
      resolve(results);
    });

    req.end();
  });

  return promise;
};
