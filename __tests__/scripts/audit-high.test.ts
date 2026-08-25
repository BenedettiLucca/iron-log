// CommonJS production script intentionally loaded through its native module boundary.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getBlockingVulnerabilities } = require('../../scripts/audit-high');

const allowedAdvisory = {
  source: 1124334,
  url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
  severity: 'high',
};

const moderateAdvisory = {
  source: 1119441,
  url: 'https://github.com/advisories/GHSA-moderate',
  severity: 'moderate',
};

describe('audit-high allowlist', () => {
  it('allows only dependency chains caused exclusively by the temporary brace-expansion advisory', () => {
    const vulnerabilities = {
      'brace-expansion': { severity: 'high', via: [allowedAdvisory] },
      minimatch: { severity: 'high', via: ['brace-expansion'] },
      glob: { severity: 'high', via: ['minimatch'] },
      expo: { severity: 'high', via: ['expo-cli', 'minimatch', moderateAdvisory] },
      'expo-cli': { severity: 'high', via: ['expo', 'minimatch'] },
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
