const https = require("https");
const dns = require("dns");

const DNS_LOOKUP_ERR = "DNS lookup timeout";
const SOCKET_TIMEOUT = "Socket timeout";

/**
 * A simple wrapper around `dns.lookup`.
 *
 * @param {string} hostname -
 * @param {number|Object} options -
 * @param {Function} callback -
 */
const lookupOrTimeout = function (hostname, options, callback) {
  let called = false;
  let timeout = undefined;

  const doCallback = function (err, address, family) {
    if (called) {
      return;
    }
    called = true;
    clearTimeout(timeout);
    callback(err, address, family);
  };

  timeout = setTimeout(function () {
    doCallback(new Error(DNS_LOOKUP_ERR), null, null);
  }, 1000);

  dns.lookup(hostname, options, doCallback);
};

const TLS_ERRORS = new Set([
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
]);

exports.handler = async function (event, context) {
  const options = {
    hostname: "example.com",
    port: 443,
    path: "/",
    method: "GET",
    timeout: 2000,
    lookup: lookupOrTimeout,
  };

  const startTime = process.hrtime();
  const promise = new Promise(function (resolve, reject) {
    const req = https.request(options, (res) => {
      const [latencySec, latencyNsec] = process.hrtime(startTime);
      let results = {
        success: true,
        status: res.statusCode,
        latency: [latencySec, latencyNsec * 1e-6],
      };
      let body = [];
      res.on("data", (chunk) => {
        body.push(chunk);
      });
      res.on("end", () => {
        const [latencySec, latencyNsec] = process.hrtime(startTime);
        results.body = Buffer.concat(body).toString();
        results.duration = [latencySec, latencyNsec * 1e-6];
        resolve(results);
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(SOCKET_TIMEOUT));
    });

    req.on("error", (error) => {
      let cause = undefined;
      if (error.message.startsWith("getaddrinfo ENOTFOUND") || error.message === DNS_LOOKUP_ERR) {
        cause = "dns";
      } else if (TLS_ERRORS.has(error.code)) {
        cause = "tls";
      } else if (error.message === SOCKET_TIMEOUT || error.code === 'ECONNRESET') {
        cause = "abort";
      }
      resolve({
        success: false,
        cause: cause,
        errorType: error.name,
        errorCode: error.code,
        errorMessage: error.message,
      });
    });

    req.end();
  });

  return promise;
};
