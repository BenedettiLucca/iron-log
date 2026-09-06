import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('wave 13.2 — session screen UI bugs (#100 #99 #98)', () => {
  it('#100 — input panel is keyboard-safe on Android (mechanism, not hope)', () => {
    const screen = read('app/session/exercise.tsx');
    // At least one explicit keyboard-avoidance mechanism at screen level:
    // KeyboardAvoidingView, or adjustResize-aware insets-driven padding.
    expect(
      /KeyboardAvoidingView|keyboardHeight|insets\.bottom/.test(screen)
    ).toBe(true);
  });

  it('#99 — SetEditor panel is compact: set list keeps visible space', () => {
    const editor = read('components/SetEditor.tsx');
    // Panel must declare an explicit max-height bound (no full-viewport panel).
    expect(editor).toMatch(/maxHeight/);
  });

  it('#99 — SetCard keeps reps label and RIR badge non-overlapping', () => {
    const card = read('components/SetCard.tsx');
    // Reps label area and RIR badge must live in separate flex children (no
    // absolute-positioned badge over the label row).
    expect(card).not.toMatch(/position:\s*['"]absolute['"][\s\S]{0,80}rir/i);
  });

  it('#98 — execution target badge has ONE fixed shape regardless of text length', () => {
    const header = read('components/session/ExerciseHeader.tsx');
    // Fixed radius + single wrapping class for the target badge (no conditional shape).
    expect(header).toMatch(/rounded-(lg|xl|full)/);
    expect(header).not.toMatch(/rounded-(sm|md)['"]?\s*:\s*.*rounded-(lg|xl|full)/);
  });
});
