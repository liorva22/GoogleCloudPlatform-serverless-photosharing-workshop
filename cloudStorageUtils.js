const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

async function generateSignedUrl(bucketName, objectName, expiration) {
  const options = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiration * 1000,
  };

  const [url] = await storage
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl(options);

  return url;
}

module.exports = {
  generateSignedUrl,
};
