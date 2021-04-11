const { pki } = require("node-forge");

/**
 * Gets a public/private key pair.
 *
 * @return {Object} The public/private key pair
 */
exports.keyPair = () => pki.rsa.generateKeyPair(2048);

/**
 * Gets a private key.
 *
 * @param {Object} keys - The public/private key pair
 * @return {string} The base64 encoded private key
 */
exports.privateKey = (keys) => pki.privateKeyToPem(keys.privateKey);

/**
 * Gets a public certificate.
 *
 * @param {Object} keys - The public/private key pair
 * @return {string} The base64 public certificate
 */
exports.publicCertificate = (keys) => {
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {
      name: "commonName",
      value: "miles.lndo.site",
    },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return pki.certificateToPem(cert);
};
