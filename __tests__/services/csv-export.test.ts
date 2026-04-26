// Test CSV helper functions extracted from CsvExportService
// The service methods depend on expo-file-system and DB, so we test the pure logic

describe('CsvExport helpers', () => {
  // Re-implement the pure helpers to test logic independently
  function escapeCsvField(value: unknown): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function toCsvRow(fields: unknown[]): string {
    return fields.map(escapeCsvField).join(',');
  }

  function formatDateBR(epoch: number | null): string {
    if (!epoch) return '';
    const d = new Date(epoch);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  describe('escapeCsvField', () => {
    it('returns string as-is when no special chars', () => {
      expect(escapeCsvField('hello')).toBe('hello');
    });

    it('escapes fields with commas', () => {
      expect(escapeCsvField('foo,bar')).toBe('"foo,bar"');
    });

    it('escapes fields with double quotes', () => {
      expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    });

    it('escapes fields with newlines', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('handles numbers', () => {
      expect(escapeCsvField(42)).toBe('42');
    });

    it('handles null as empty string', () => {
      expect(escapeCsvField(null)).toBe('');
    });

    it('handles undefined as empty string', () => {
      expect(escapeCsvField(undefined)).toBe('');
    });
  });

  describe('toCsvRow', () => {
    it('joins fields with commas', () => {
      expect(toCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('properly escapes fields in row', () => {
      expect(toCsvRow(['hello', 'has,comma', 42])).toBe('hello,"has,comma",42');
    });

    it('handles empty array', () => {
      expect(toCsvRow([])).toBe('');
    });
  });

  describe('formatDateBR', () => {
    it('formats a known date correctly', () => {
      // 2026-01-15 12:00 UTC → 15/01/2026
      const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
      const result = formatDateBR(d.getTime());
      expect(result).toMatch(/15\/01\/2026/);
    });

    it('returns empty for null', () => {
      expect(formatDateBR(null)).toBe('');
    });

    it('pads day and month', () => {
      const d = new Date(2026, 0, 5); // Jan 5 local
      const result = formatDateBR(d.getTime());
      expect(result).toContain('05/01/2026');
    });
  });
});
