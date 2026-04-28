import { formatMonthYear, calculateChange, getPhotoOverlayData } from '../../src/utils/checkin';
import { BodyMetric } from '../../src/types';

describe('checkin utils', () => {
  describe('formatMonthYear', () => {
    it('formats epoch to month year in pt-BR', () => {
      const result = formatMonthYear(new Date(2026, 3, 15).getTime(), 'pt-BR');
      expect(result).toBe('abril de 2026');
    });

    it('formats epoch to month year in en-US', () => {
      const result = formatMonthYear(new Date(2026, 3, 15).getTime(), 'en-US');
      expect(result).toBe('April 2026');
    });
  });

  describe('calculateChange', () => {
    it('returns positive change with + sign', () => {
      expect(calculateChange(120, 118)).toBe('+2.0');
    });

    it('returns negative change with - sign', () => {
      expect(calculateChange(118, 120)).toBe('-2.0');
    });

    it('returns 0 when equal', () => {
      expect(calculateChange(120, 120)).toBe('0.0');
    });

    it('returns em-dash when current is null', () => {
      expect(calculateChange(null, 120)).toBe('—');
    });

    it('returns em-dash when previous is null', () => {
      expect(calculateChange(120, null)).toBe('—');
    });
  });

  describe('getPhotoOverlayData', () => {
    it('extracts weight and waist from metric', () => {
      const metric: Partial<BodyMetric> = { weight: 116.5, waist: 87 };
      const result = getPhotoOverlayData(metric as BodyMetric);
      expect(result).toEqual({ weight: '116.5 kg', waist: '87 cm' });
    });

    it('returns null for missing values', () => {
      const metric: Partial<BodyMetric> = { weight: null, waist: null };
      const result = getPhotoOverlayData(metric as BodyMetric);
      expect(result).toEqual({ weight: null, waist: null });
    });

    it('returns mixed when only weight present', () => {
      const metric: Partial<BodyMetric> = { weight: 110, waist: null };
      const result = getPhotoOverlayData(metric as BodyMetric);
      expect(result).toEqual({ weight: '110 kg', waist: null });
    });
  });
});
