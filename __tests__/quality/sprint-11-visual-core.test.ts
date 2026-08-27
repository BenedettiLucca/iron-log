import fs from 'node:fs';
import path from 'node:path';
import { jsxElements } from './jsx-source';

const root = path.resolve(__dirname, '../..');

describe('Sprint 11 visual core contracts', () => {
  describe('app/routines/templates.tsx', () => {
    const templatesSource = fs.readFileSync(
      path.join(root, 'app/routines/templates.tsx'),
      'utf8',
    );

    it('has no redundant custom back button and relies on native Stack header', () => {
      const touchables = jsxElements('app/routines/templates.tsx', 'TouchableOpacity');
      const customBackBtn = touchables.find(
        (element) => element.getText().includes('router.back()') && element.getText().includes('absolute'),
      );
      expect(customBackBtn).toBeUndefined();
      expect(templatesSource).not.toContain('className="absolute top-4 left-4');
    });

    it('removes unexplained top whitespace (pt-16) from the header container', () => {
      expect(templatesSource).not.toContain('pt-16');
      expect(templatesSource).toMatch(/className="[^"]*\bpt-4\b[^"]*"/);
    });

    it('preserves localized section header title and description', () => {
      expect(templatesSource).toContain("t('routines.templateLibrary')");
      expect(templatesSource).toContain("t('routines.templateLibraryDesc')");
    });

    it('has no hardcoded user-facing string fallback', () => {
      expect(templatesSource).not.toMatch(/t\([^)]+\)\s*\|\|\s*['"][^'"]+['"]/);
    });
  });

  describe('components/session/WarmupToggle.tsx', () => {
    const warmupSource = fs.readFileSync(
      path.join(root, 'components/session/WarmupToggle.tsx'),
      'utf8',
    );

    it('centers the thumb in the track vertically and horizontally without p-0.5 offset', () => {
      expect(warmupSource).not.toContain('p-0.5');
      expect(warmupSource).toContain('justify-center');
      expect(warmupSource).toMatch(/\b(p-1|px-1)\b/);
      expect(warmupSource).toContain('w-12 h-7 rounded-full');
      expect(warmupSource).toContain('w-5 h-5 rounded-full');
    });

    it('derives thumb travel from fixed track geometry and keeps reduced motion support', () => {
      expect(warmupSource).toContain('translateX: progress.value * travelDistance');
      expect(warmupSource).toContain('const travelDistance = DEFAULT_TRACK_WIDTH - 2 * TRACK_PADDING - THUMB_SIZE');
      expect(warmupSource).toContain('useReactiveReducedMotion');
    });

    it('has no hardcoded user-facing string fallback', () => {
      expect(warmupSource).not.toMatch(/t\([^)]+\)\s*\|\|\s*['"][^'"]+['"]/);
    });
  });
});
