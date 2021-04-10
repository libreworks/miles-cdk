const http = require("http");
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
    error: {
      type: error.name,
      code: error.code,
      message: error.message,
    },
  };
};

/**
 * A simple wrapper around `dns.lookup`.
 *
 * Hats off to @BinaryMuse for the inspiration:
 * https://stackoverflow.com/questions/10777657/node-js-dns-lookup-how-to-set-timeout/45403565
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
  }, 10000);

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
 * Expects a JSON payload in the `body` attribute containing the following keys:
 *   - url: The URL to walk.
 *   - method: The HTTP method to invoke.
 *   - timeout: The number of milliseconds after which the request will abort.
 *
 * @param {Object} event - The event payload.
 * @param {Object} context - The Lambda context.
 * @returns {Promise} - The invocation results.
 * @throws {SyntaxError} if the body attribute of the event is invalid JSON.
 * @throws {TypeError} if the URL in the parsed body object is invalid RFC 1738.
 * @throws {RangeError} if the timeout in the parsed body object is NaN.
 */
exports.handler = async function (event, context) {
  const body = JSON.parse(event.body || {});
  const url = new URL(`${body.url}`);
  const isTls = url.protocol.startsWith("https");
  const requestFunction = isTls ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isTls ? "443" : "80"),
    path: url.pathname,
    method: `${body.method}`,
    timeout: parseInt(body.timeout) || 10,
    lookup: lookupOrTimeout,
  };
  console.log("🐝  I'm gonna bee! ", {
    hostname: options.hostname,
    tls: isTls,
    port: options.port,
    path: options.path,
    method: options.method,
    timeout: options.timeout,
  });

  const promise = new Promise((resolve, reject) => {
    let results = { success: true };
    const startTime = process.hrtime();
    const req = requestFunction.request(options, (res) => {
      results.status = res.statusCode;
      results.latency = toMillis(process.hrtime(startTime));
      let body = [];
      res.on("data", (chunk) => {
        body.push(chunk);
      });
      res.on("end", () => {
        results.body = Buffer.concat(body).toString();
        console.info(`🙆  Success! HTTP ${results.status}`);
      });
    });

    req.on("timeout", () => {
      const err = new Error(SOCKET_TIMEOUT_ERR);
      err.code = "ECONNTIMEOUT";
      req.destroy(err);
    });

    req.on("error", (error) => {
      Object.assign(results, createErrorPayload(error));
      console.info(
        `🙅  Failure! Cause is '${results.cause}', error is `,
        results.error
      );
    });

    req.on("close", () => {
      results.duration = toMillis(process.hrtime(startTime));
      console.info(
        `🚶  This walk took ${results.duration[0]} seconds, ${results.duration[1]} milliseconds`
      );
      resolve(results);
    });

    req.end();
  });

  return promise;
};
