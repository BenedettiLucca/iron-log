const fs = require('node:fs');
const path = require('node:path');

function isNonEmptyRegularFile(filePath) {
  try {
    const stats = fs.lstatSync(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

function verifyAndroidExport(outputDir = 'dist') {
  const metadataPath = path.join(outputDir, 'metadata.json');
  if (!isNonEmptyRegularFile(metadataPath)) {
    throw new Error(`Android export is missing non-empty metadata.json: ${metadataPath}`);
  }

  try {
    JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    throw new Error(`Android export metadata.json is not valid JSON: ${metadataPath}`);
  }

  const bundleDir = path.join(outputDir, '_expo', 'static', 'js', 'android');
  const bundles = fs.existsSync(bundleDir)
    ? fs.readdirSync(bundleDir)
      .filter((name) => name.endsWith('.hbc'))
      .map((name) => {
        const bundlePath = path.join(bundleDir, name);
        const stats = fs.lstatSync(bundlePath);
        return {
          bundlePath,
          bundleBytes: stats.isFile() ? stats.size : 0,
        };
      })
      .filter(({ bundleBytes }) => bundleBytes > 0)
      .sort((a, b) => b.bundleBytes - a.bundleBytes)
    : [];

  if (bundles.length === 0) {
    throw new Error(`Android export is missing a non-empty .hbc bundle: ${bundleDir}`);
  }

  return bundles[0];
}

if (require.main === module) {
  try {
    const result = verifyAndroidExport(process.argv[2]);
    console.log(`Verified Android Hermes bundle: ${result.bundlePath} (${result.bundleBytes} bytes)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { verifyAndroidExport };
