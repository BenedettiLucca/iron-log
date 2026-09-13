import fs from 'fs';
import path from 'path';
import { parseEditedSetInput } from '../../src/validators/forms';

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

  it('#129 — decimal weight inputs use keyboardType="decimal-pad"', () => {
    const screen = read('app/session/exercise.tsx');
    const editor = read('components/SetEditor.tsx');

    // Weight inputs must use decimal-pad for localized decimal entry (comma/dot)
    expect(screen).toMatch(/keyboardType="decimal-pad"/);
    expect(editor).toMatch(/keyboardType="decimal-pad"/);
  });

  it('#100 — input panel in exercise.tsx condenses non-essential controls when keyboard is open', () => {
    const screen = read('app/session/exercise.tsx');
    // While typing, the save button must remain visible by suppressing the next-exercise advance CTA
    expect(screen).toMatch(/!isKeyboardVisible|!keyboardHeight/);
  });
});

describe('session UI component behavior & C2 input contracts', () => {
  it('#129 — parseEditedSetInput validates localized decimal weights (Contract C2)', () => {

    // Comma decimal (pt-BR)
    const commaResult = parseEditedSetInput({
      weight: '72,5',
      reps: '10',
      rir: '2',
      isDuration: false,
    });
    expect(commaResult.ok).toBe(true);
    if (commaResult.ok) {
      expect(commaResult.weightKg).toBe(72.5);
      expect(commaResult.reps).toBe(10);
      expect(commaResult.rir).toBe(2);
    }

    // Dot decimal (en-US)
    const dotResult = parseEditedSetInput({
      weight: '72.5',
      reps: '8',
      isDuration: false,
    });
    expect(dotResult.ok).toBe(true);
    if (dotResult.ok) {
      expect(dotResult.weightKg).toBe(72.5);
      expect(dotResult.reps).toBe(8);
    }

    // Integer weight
    const intResult = parseEditedSetInput({
      weight: '80',
      reps: '12',
      isDuration: false,
    });
    expect(intResult.ok).toBe(true);
    if (intResult.ok) {
      expect(intResult.weightKg).toBe(80);
    }

    // Reject mixed separators
    const mixedResult = parseEditedSetInput({
      weight: '72,5.5',
      reps: '10',
      isDuration: false,
    });
    expect(mixedResult.ok).toBe(false);
    if (!mixedResult.ok) {
      expect(mixedResult.errors.weight).toBe('invalid');
    }

    // Reject invalid trailing characters (strict C2, not parseFloat)
    const trailingResult = parseEditedSetInput({
      weight: '72.5kg',
      reps: '10',
      isDuration: false,
    });
    expect(trailingResult.ok).toBe(false);
  });

  it('#98 — ExerciseHeader target badge handles short and long targets with 2-line wrap and fixed shape', () => {
    const headerSource = read('components/session/ExerciseHeader.tsx');
    // Confirms 2-line wrap constraint so targets like "3x8-12 por perna" do not clip
    expect(headerSource).toContain('numberOfLines={2}');
    expect(headerSource).toContain('rounded-lg border border-border');
  });

  it('#99 — SetCard keeps reps label concise and RIR badge flex-shrink-0 to prevent layout collapse', () => {
    const cardSource = read('components/SetCard.tsx');
    // Confirms flex-shrink-0 on RIR container and min-w-0 on reps container
    expect(cardSource).toContain('flex-shrink-0');
    expect(cardSource).toContain('min-w-0');
    expect(cardSource).toContain('repsLabel');
  });
});
