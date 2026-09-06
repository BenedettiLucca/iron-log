import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#97 keyboard safety — device-verified contract (QA 2026-09-05 FAIL)', () => {
  const modal = read('components/FolderManagerModal.tsx');

  it('AVD-verified fix exists (KeyboardAvoidingView + focus scroll)', () => {
    expect(modal).toContain('KeyboardAvoidingView');
    expect(modal).toContain('scrollResponderScrollNativeHandleToKeyboard');
    expect(modal).toContain('flexShrink: 1');
  });

  it('sheet container does NOT rely on flexShrink alone — bottom CTA anchored at panel level', () => {
    // QA 2026-09-05: with the keyboard open, the create/rename CTA stays covered.
    // flexShrink lets the SHEET shrink, but the Scroll content still pushes the
    // button below the keyboard inset on the device. The CTA must live at panel
    // level, OUTSIDE the ScrollView, so it can never be scrolled under.
    expect(modal).toMatch(/KeyboardAvoidingView[\s\S]*?View(?![\s\S]*ScrollView[\s\S]*?<Button[^>]*title=\{t\('routines\.createFolder'\)\})[\s\S]*?<\/KeyboardAvoidingView>/);
  });

  it('create/rename CTAs render outside the ScrollView (always above keyboard)', () => {
    const scrollIdx = modal.indexOf('<ScrollView');
    const scrollEnd = modal.indexOf('</ScrollView>');
    expect(scrollIdx).toBeGreaterThan(-1);
    expect(scrollEnd).toBeGreaterThan(scrollIdx);
    expect(modal.slice(scrollIdx, scrollEnd)).not.toContain("t('routines.createFolder')");
    expect(modal.slice(scrollIdx, scrollEnd)).not.toContain("t('common.rename')");
  });
});
