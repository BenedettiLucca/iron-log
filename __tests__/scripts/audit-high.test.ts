// CommonJS production script intentionally loaded through its native module boundary.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getBlockingVulnerabilities } = require('../../scripts/audit-high');

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
