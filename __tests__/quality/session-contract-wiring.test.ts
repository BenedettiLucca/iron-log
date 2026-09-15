import fs from 'fs';
import path from 'path';

const finishSource = fs.readFileSync(
  path.join(__dirname, '../../app/session/finish.tsx'),
  'utf8',
);
const summarySource = fs.readFileSync(
  path.join(__dirname, '../../app/session/summary.tsx'),
  'utf8',
);

describe('Contract A — finish.tsx wiring', () => {
  it('imports and uses evaluateFinishIntent', () => {
    expect(finishSource).toMatch(/evaluateFinishIntent/);
  });

  it('empty state uses log-set as the only filled primary', () => {
    expect(finishSource).toMatch(/finish\.logSetButton/);
    expect(finishSource).toMatch(/intent\.kind === 'empty'/);
  });

  it('does not keep a filled danger discard as the competing primary', () => {
    expect(finishSource).not.toMatch(/variant=["']danger["']/);
  });

  it('confirmFinish refuses to persist when intent.persist is false', () => {
    expect(finishSource).toMatch(/if \(!intent\.persist\)/);
  });
});

describe('Contract A — summary duration rendering', () => {
  it('uses formatLoggedSet so plank sets do not render as 0kg x 0', () => {
    expect(summarySource).toMatch(/formatLoggedSet/);
  });
});
