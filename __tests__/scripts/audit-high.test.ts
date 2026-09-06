// CommonJS production script intentionally loaded through its native module boundary.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcess = require('node:child_process');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getBlockingVulnerabilities, runAudit } = require('../../scripts/audit-high');

const allowedAdvisory = {
  source: 1124334,
  url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
  severity: 'high',
};

const allowedImageSizeAdvisories = [
  {
    source: 1138808,
    url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
    severity: 'high',
  },
  {
    source: 1138809,
    url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
    severity: 'high',
  },
];

const moderateAdvisory = {
  source: 1119441,
  url: 'https://github.com/advisories/GHSA-moderate',
  severity: 'moderate',
};

describe('audit-high allowlist', () => {
  it('allows only dependency chains caused exclusively by temporary Expo toolchain advisories', () => {
    const vulnerabilities = {
      'brace-expansion': { severity: 'high', via: [allowedAdvisory] },
      'image-size': { severity: 'high', via: allowedImageSizeAdvisories },
      minimatch: { severity: 'high', via: ['brace-expansion'] },
      glob: { severity: 'high', via: ['minimatch'] },
      metro: { severity: 'high', via: ['image-size'] },
      expo: { severity: 'high', via: ['expo-cli', 'metro', 'minimatch', moderateAdvisory] },
      'expo-cli': { severity: 'high', via: ['expo', 'metro', 'minimatch'] },
    };

    expect(getBlockingVulnerabilities(vulnerabilities)).toEqual([]);
  });

  it('still blocks any unrelated or mixed high-severity advisory', () => {
    const vulnerabilities = {
      'brace-expansion': { severity: 'high', via: [allowedAdvisory] },
      minimatch: { severity: 'high', via: ['brace-expansion'] },
      exposed: {
        severity: 'high',
        via: [
          'minimatch',
          {
            source: 9999999,
            url: 'https://github.com/advisories/GHSA-not-allowed',
            severity: 'high',
          },
        ],
      },
      critical: { severity: 'critical', via: [] },
      moderate: { severity: 'moderate', via: [] },
    };

    expect(getBlockingVulnerabilities(vulnerabilities).sort()).toEqual(['critical', 'exposed']);
  });
});

describe('runAudit fail-closed behavior (#108)', () => {
  let spawnSyncSpy: jest.SpyInstance;

  beforeEach(() => {
    spawnSyncSpy = jest.spyOn(childProcess, 'spawnSync');
  });

  afterEach(() => {
    spawnSyncSpy.mockRestore();
  });

  it('fails closed when npm audit returns an error envelope with status 1', () => {
    spawnSyncSpy.mockReturnValue({
      status: 1,
      signal: null,
      stdout: JSON.stringify({
        error: { code: 'ENOTFOUND', summary: 'registry offline', detail: 'request failed' },
      }),
      stderr: 'npm ERR! code ENOTFOUND',
    });

    expect(runAudit()).toBe(1);
  });

  it('fails closed when audit returns empty JSON without vulnerabilities or metadata', () => {
    spawnSyncSpy.mockReturnValue({
      status: 0,
      signal: null,
      stdout: '{}',
      stderr: '',
    });

    expect(runAudit()).toBe(1);
  });

  it('fails closed on invalid/empty stdout', () => {
    spawnSyncSpy.mockReturnValue({
      status: 1,
      signal: null,
      stdout: 'not json',
      stderr: 'some error',
    });

    expect(runAudit()).toBe(1);
  });

  it('fails closed on spawn error', () => {
    spawnSyncSpy.mockReturnValue({
      error: new Error('spawn ENOENT'),
      status: null,
      signal: null,
      stdout: null,
      stderr: '',
    });

    expect(runAudit()).toBe(1);
  });

  it('fails closed on signal termination / null status', () => {
    spawnSyncSpy.mockReturnValue({
      status: null,
      signal: 'SIGKILL',
      stdout: '{}',
      stderr: '',
    });

    expect(runAudit()).toBe(1);
  });

  it('passes on valid audit report without blockers with status 0', () => {
    spawnSyncSpy.mockReturnValue({
      status: 0,
      signal: null,
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {},
        metadata: { vulnerabilities: { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 } },
      }),
      stderr: '',
    });

    expect(runAudit()).toBe(0);
  });

  it('passes on valid audit report with only allowlisted advisories even if status is 1', () => {
    spawnSyncSpy.mockReturnValue({
      status: 1,
      signal: null,
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          'brace-expansion': { severity: 'high', via: [allowedAdvisory] },
        },
        metadata: { vulnerabilities: { total: 1, critical: 0, high: 1, moderate: 0, low: 0, info: 0 } },
      }),
      stderr: '',
    });

    expect(runAudit()).toBe(0);
  });

  it('fails on non-allowlisted blocker advisory', () => {
    spawnSyncSpy.mockReturnValue({
      status: 1,
      signal: null,
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          'malicious-pkg': { severity: 'high', via: [{ source: 123, url: 'https://github.com/advisories/GHSA-bad', severity: 'high' }] },
        },
        metadata: { vulnerabilities: { total: 1, critical: 0, high: 1, moderate: 0, low: 0, info: 0 } },
      }),
      stderr: '',
    });

    expect(runAudit()).toBe(1);
  });
});
