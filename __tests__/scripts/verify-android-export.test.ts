import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The CI verifier is CommonJS so it can run directly with Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { verifyAndroidExport } = require('../../scripts/verify-android-export');

describe('Android export verifier', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-log-android-export-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('rejects an export without metadata', () => {
    expect(() => verifyAndroidExport(outputDir)).toThrow('metadata.json');
  });

  it('rejects a metadata directory masquerading as a file', () => {
    fs.mkdirSync(path.join(outputDir, 'metadata.json'));
    const bundleDir = path.join(outputDir, '_expo/static/js/android');
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(path.join(bundleDir, 'entry-valid.hbc'), 'hermes-bytecode');

    expect(() => verifyAndroidExport(outputDir)).toThrow('metadata.json');
  });

  it('rejects malformed metadata JSON', () => {
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), 'not-json');
    const bundleDir = path.join(outputDir, '_expo/static/js/android');
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(path.join(bundleDir, 'entry-valid.hbc'), 'hermes-bytecode');

    expect(() => verifyAndroidExport(outputDir)).toThrow('valid JSON');
  });

  it('rejects an export without a non-empty Hermes bundle', () => {
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), '{}');
    const bundleDir = path.join(outputDir, '_expo/static/js/android');
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(path.join(bundleDir, 'entry-empty.hbc'), '');

    expect(() => verifyAndroidExport(outputDir)).toThrow('non-empty .hbc');
  });

  it('rejects a directory masquerading as a Hermes bundle', () => {
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), '{}');
    const bundleDir = path.join(outputDir, '_expo/static/js/android');
    fs.mkdirSync(path.join(bundleDir, 'fake.hbc'), { recursive: true });

    expect(() => verifyAndroidExport(outputDir)).toThrow('non-empty .hbc');
  });

  it('accepts a non-empty metadata file and Hermes bundle', () => {
    fs.writeFileSync(path.join(outputDir, 'metadata.json'), '{}');
    const bundleDir = path.join(outputDir, '_expo/static/js/android');
    fs.mkdirSync(bundleDir, { recursive: true });
    const bundlePath = path.join(bundleDir, 'entry-test.hbc');
    fs.writeFileSync(bundlePath, 'hermes-bytecode');

    expect(verifyAndroidExport(outputDir)).toEqual({
      bundlePath,
      bundleBytes: 15,
    });
  });
});
