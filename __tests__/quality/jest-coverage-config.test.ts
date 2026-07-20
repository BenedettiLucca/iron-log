const jestConfig = require('../../jest.config');

describe('Jest coverage contract', () => {
  it('collects production utilities from the real source directory', () => {
    expect(jestConfig.collectCoverageFrom).toContain('src/utils/**/*.{js,jsx,ts,tsx}');
    expect(jestConfig.collectCoverageFrom).not.toContain('utils/**/*.{js,jsx,ts,tsx}');
  });

  it('keeps a non-zero global coverage floor', () => {
    expect(jestConfig.coverageThreshold.global).toEqual({
      branches: 20,
      functions: 20,
      lines: 20,
      statements: 20,
    });
  });
});
