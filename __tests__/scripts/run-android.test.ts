import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('scripts/run-android.sh SDK resolution', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/run-android.sh');
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iron-log-android-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('fails closed when ANDROID_HOME does not exist and no fallback SDK is found', () => {
    const result = spawnSync('bash', [scriptPath], {
      env: { ...process.env,
        PATH: '/usr/bin:/bin',
        HOME: tempDir,
        ANDROID_HOME: path.join(tempDir, 'non-existent'),
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ANDROID_HOME is not set or directory does not exist');
  });

  it('fails when ANDROID_HOME is set but adb is missing in platform-tools', () => {
    const fakeSdk = path.join(tempDir, 'fake-sdk');
    fs.mkdirSync(fakeSdk, { recursive: true });

    const result = spawnSync('bash', [scriptPath], {
      env: { ...process.env,
        PATH: '/usr/bin:/bin',
        HOME: tempDir,
        ANDROID_HOME: fakeSdk,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('adb not found');
  });

  it('resolves ANDROID_HOME and adb successfully in dry-run mode', () => {
    const fakeSdk = path.join(tempDir, 'fake-sdk');
    const platformTools = path.join(fakeSdk, 'platform-tools');
    fs.mkdirSync(platformTools, { recursive: true });
    const fakeAdb = path.join(platformTools, 'adb');
    fs.writeFileSync(fakeAdb, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const result = spawnSync('bash', [scriptPath, '--dry-run'], {
      env: { ...process.env,
        PATH: '/usr/bin:/bin',
        HOME: tempDir,
        ANDROID_HOME: fakeSdk,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Using Android SDK at: ${fakeSdk}`);
    expect(result.stdout).toContain('Dry run successful: adb resolved');
  });

  it('respects ANDROID_SDK_ROOT when ANDROID_HOME is unset', () => {
    const fakeSdk = path.join(tempDir, 'sdk-root');
    const platformTools = path.join(fakeSdk, 'platform-tools');
    fs.mkdirSync(platformTools, { recursive: true });
    const fakeAdb = path.join(platformTools, 'adb');
    fs.writeFileSync(fakeAdb, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

    const result = spawnSync('bash', [scriptPath, '--dry-run'], {
      env: { ...process.env,
        PATH: '/usr/bin:/bin',
        HOME: tempDir,
        ANDROID_HOME: '',
        ANDROID_SDK_ROOT: fakeSdk,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Using Android SDK at: ${fakeSdk}`);
  });
});
