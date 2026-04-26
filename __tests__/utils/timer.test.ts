import { formatTimer } from '@/src/utils/timer';

describe('formatTimer', () => {
  it('formats 0 seconds as "0:00"', () => {
    expect(formatTimer(0)).toBe('0:00');
  });

  it('formats 30 seconds as "0:30"', () => {
    expect(formatTimer(30)).toBe('0:30');
  });

  it('formats 60 seconds as "1:00"', () => {
    expect(formatTimer(60)).toBe('1:00');
  });

  it('formats 90 seconds as "1:30"', () => {
    expect(formatTimer(90)).toBe('1:30');
  });

  it('formats 3661 seconds as "61:01"', () => {
    expect(formatTimer(3661)).toBe('61:01');
  });

  it('formats 5 seconds as "0:05"', () => {
    expect(formatTimer(5)).toBe('0:05');
  });

  it('formats 600 seconds as "10:00"', () => {
    expect(formatTimer(600)).toBe('10:00');
  });

  it('formats 1 second as "0:01"', () => {
    expect(formatTimer(1)).toBe('0:01');
  });
});
