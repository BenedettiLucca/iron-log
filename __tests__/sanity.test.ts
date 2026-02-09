describe('Sanity Tests', () => {
  it('should pass basic math', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const str = 'Iron Log';
    expect(str).toBe('Iron Log');
  });

  it('should work with objects', () => {
    const obj = { name: 'Test', value: 123 };
    expect(obj.name).toBe('Test');
    expect(obj.value).toBe(123);
  });
});
