const path = require("path");
const assert = require("assert");
const http = require("http");
const lambdaLocal = require("lambda-local");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const withHttpServer = async (port, handler, callback) => {
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const server = http.createServer({}, handler);
      server.on('clientError', (err, socket) => {
        if (err.code === 'ECONNRESET' || !socket.writable) {
          return;
        }
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      });
      server.listen(port, () => {
        resolve(server);
      });
    });
    await callback(server);
  } finally {
    if (server) {
      server.close();
    }
  }
};

test("AWS Lambda: walk 200", async () => {
  const expectedBody = JSON.stringify({foo: 'bar'});
  const handler = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.write(expectedBody, 'utf8');
    res.end();
  };
  await withHttpServer(8888, handler, async (server) => {
    const results = await lambdaLocal.execute({
      event: {body: JSON.stringify({url: "http://localhost:8888", method: 'GET', timeout: 60000})},
      lambdaPath: path.normalize(
        path.join(__dirname, "..", "..", "lambda", "walk", "index.js")
      ),
      timeoutMs: 10000,
    });
    assert.strictEqual(results.status, 200);
    assert.strictEqual(results.success, true);
    assert.strictEqual(results.body, expectedBody);
  });
});

test("AWS Lambda: walk connection refused", async () => {
  const handler = (req, res) => {};
  await withHttpServer(8889, (handler), async (server) => {
    const results = await lambdaLocal.execute({
      event: {body: JSON.stringify({url: "http://localhost:8888", method: 'GET', timeout: 60000})},
      lambdaPath: path.normalize(
        path.join(__dirname, "..", "..", "lambda", "walk", "index.js")
      ),
      timeoutMs: 10000,
    });
    assert.strictEqual(results.success, false);
    assert.strictEqual(results.cause, 'abort');
    assert.strictEqual(results.error.type, 'Error');
    assert.strictEqual(results.error.code, 'ECONNREFUSED');
    assert.strictEqual(results.error.message, 'connect ECONNREFUSED 127.0.0.1:8888');
  });
});

test("AWS Lambda: connection timeout", async () => {
  const handler = async (req, res) => {
    await sleep(2000);
  };
  await withHttpServer(8890, (handler), async (server) => {
    const results = await lambdaLocal.execute({
      event: {body: JSON.stringify({url: "http://localhost:8890", method: 'GET', timeout: 1000})},
      lambdaPath: path.normalize(
        path.join(__dirname, "..", "..", "lambda", "walk", "index.js")
      ),
      timeoutMs: 3000,
    });
    assert.strictEqual(results.success, false);
    assert.strictEqual(results.cause, 'abort');
    assert.strictEqual(results.error.type, 'Error');
    assert.strictEqual(results.error.code, 'ECONNTIMEOUT');
    assert.strictEqual(results.error.message, 'Socket timeout');
  });
});
