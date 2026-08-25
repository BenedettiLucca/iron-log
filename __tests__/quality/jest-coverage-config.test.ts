// Jest's runtime config is CommonJS; requiring it here tests the actual exported object.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jestConfig = require('../../jest.config');

describe('Jest coverage contract', () => {
  it('collects production utilities from the real source directory', () => {
    expect(jestConfig.collectCoverageFrom).toContain('src/utils/**/*.{js,jsx,ts,tsx}');
    expect(jestConfig.collectCoverageFrom).not.toContain('utils/**/*.{js,jsx,ts,tsx}');
  });

  it('keeps every global coverage floor at or above 75%', () => {
    const floors = Object.values(jestConfig.coverageThreshold.global) as number[];

    expect(floors).toHaveLength(4);
    for (const floor of floors) {
      expect(floor).toBeGreaterThanOrEqual(75);
    }
  });
});
