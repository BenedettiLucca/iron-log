import React from 'react';
import { render } from '@testing-library/react-native';
import { Dialog } from '@/components/Dialog';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockDismissKeyboard = jest.fn();
const mockFocusAccessibilityNode = jest.fn();
const mockInsets = { top: 44, right: 3, bottom: 34, left: 5 };

jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  __esModule: true,
  default: { dismiss: mockDismissKeyboard },
}));
jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock('@/src/utils/accessibility', () => ({
  focusAccessibilityNode: (...args: unknown[]) => mockFocusAccessibilityNode(...args),
}));
jest.mock('@/components/Button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));
jest.mock('@/src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({ 'common.confirm': 'Confirmar', 'common.cancel': 'Cancelar' })[key] ?? key,
  }),
}));

function renderDialog(overrides: Record<string, unknown> = {}) {
  return render(
    <Dialog
      visible
      title="Excluir treino"
      message="Essa ação não pode ser desfeita."
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      {...overrides}
    />
  );
}

describe('Dialog', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame;
  });

  afterAll(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('uses real safe-area padding instead of fixed modal margins', () => {
    const result = renderDialog();
    const [backdrop] = result.UNSAFE_getAllByType('TouchableOpacity' as any);

    expect(backdrop.props.style).toEqual({
      paddingTop: 44,
      paddingRight: 24,
      paddingBottom: 34,
      paddingLeft: 24,
    });
    expect(backdrop.props.accessible).toBe(false);
    expect(result.UNSAFE_getByType('Modal' as any).props.statusBarTranslucent).toBe(true);
    expect(result.UNSAFE_getByType('Modal' as any).props.navigationBarTranslucent).toBe(true);
  });

  it('dismisses the keyboard and moves accessibility focus to its heading on show', () => {
    const result = renderDialog();
    const modal = result.UNSAFE_getByType('Modal' as any);
    const heading = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'Excluir treino');

    modal.props.onShow();

    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    expect(mockFocusAccessibilityNode).toHaveBeenCalledTimes(1);
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(heading?.props.accessible).toBe(true);
  });

  it('closes from the backdrop, any focused element escape, or Android back', () => {
    const onCancel = jest.fn();
    const result = renderDialog({ onCancel });
    const modal = result.UNSAFE_getByType('Modal' as any);
    const [backdrop, surface] = result.UNSAFE_getAllByType('TouchableOpacity' as any);
    const accessibleTexts = result
      .UNSAFE_getAllByType('Text' as any)
      .filter((node) => node.props.accessible === true);
    const buttons = result.UNSAFE_getAllByType('Button' as any);

    expect(modal.props.accessibilityViewIsModal).toBe(true);
    expect(surface.props.accessibilityViewIsModal).toBe(true);
    expect(surface.props.accessible).toBe(false);
    expect(surface.props.onAccessibilityEscape).toBeUndefined();
    expect(accessibleTexts).toHaveLength(2);
    expect(buttons).toHaveLength(2);

    backdrop.props.onPress();
    accessibleTexts.forEach((node) => node.props.onAccessibilityEscape());
    buttons.forEach((button) => button.props.onAccessibilityEscape());
    modal.props.onRequestClose();

    expect(onCancel).toHaveBeenCalledTimes(6);
  });

  it('does not close when the dialog surface itself is pressed', () => {
    const onCancel = jest.fn();
    const result = renderDialog({ onCancel });
    const [, surface] = result.UNSAFE_getAllByType('TouchableOpacity' as any);
    const stopPropagation = jest.fn();

    surface.props.onPress({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('restores an explicit trigger after confirm or cancel and preserves button semantics', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const returnNode = {} as import('react').Component;
    const returnFocusRef = { current: returnNode };
    const result = renderDialog({
      onConfirm,
      onCancel,
      returnFocusRef,
      type: 'destructive',
    } as any);
    const buttons = result.UNSAFE_getAllByType('Button' as any);

    expect(buttons[0].props.title).toBe('Confirmar');
    expect(buttons[0].props.variant).toBe('danger');
    expect(buttons[1].props.title).toBe('Cancelar');

    buttons[0].props.onPress();
    buttons[1].props.onPress();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockFocusAccessibilityNode).toHaveBeenCalledTimes(2);
    expect(mockFocusAccessibilityNode).toHaveBeenNthCalledWith(1, returnNode);
    expect(mockFocusAccessibilityNode).toHaveBeenNthCalledWith(2, returnNode);
  });
});
