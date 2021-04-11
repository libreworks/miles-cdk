const http = require("http");
const https = require("https");
const { pki } = require("node-forge");
const { keyPair, privateKey, publicCertificate } = require("./crypto");

exports.withHttpsServer = async (port, handler, callback) => {
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const keys = keyPair();
      const server = https.createServer(
        {
          key: privateKey(keys),
          cert: publicCertificate(keys),
        },
        handler
      );
      server.on("clientError", (err, socket) => {
        if (err.code === "ECONNRESET" || !socket.writable) {
          return;
        }
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
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

exports.withHttpServer = async (port, handler, callback) => {
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const server = http.createServer({}, handler);
      server.on("clientError", (err, socket) => {
        if (err.code === "ECONNRESET" || !socket.writable) {
          return;
        }
        socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
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
