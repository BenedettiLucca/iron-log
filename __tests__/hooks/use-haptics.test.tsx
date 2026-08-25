import { act, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useHaptics } from '@/hooks/use-haptics';

const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
const mockSelectionAsync = jest.fn();

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light-impact',
    Medium: 'medium-impact',
    Heavy: 'heavy-impact',
  },
  NotificationFeedbackType: {
    Success: 'success-notification',
    Warning: 'warning-notification',
    Error: 'error-notification',
  },
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
}));

describe('useHaptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['light', Haptics.ImpactFeedbackStyle.Light],
    ['medium', Haptics.ImpactFeedbackStyle.Medium],
    ['heavy', Haptics.ImpactFeedbackStyle.Heavy],
  ] as const)('maps %s to the matching impact feedback', (type, nativeType) => {
    const { result } = renderHook(() => useHaptics());

    act(() => result.current.trigger(type));

    expect(mockImpactAsync).toHaveBeenCalledWith(nativeType);
    expect(mockNotificationAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['success', Haptics.NotificationFeedbackType.Success],
    ['warning', Haptics.NotificationFeedbackType.Warning],
    ['error', Haptics.NotificationFeedbackType.Error],
  ] as const)('maps %s to the matching notification feedback', (type, nativeType) => {
    const { result } = renderHook(() => useHaptics());

    act(() => result.current.trigger(type));

    expect(mockNotificationAsync).toHaveBeenCalledWith(nativeType);
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('maps selection and keeps medium as the default', () => {
    const { result } = renderHook(() => useHaptics());

    act(() => result.current.trigger('selection'));
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);

    act(() => result.current.trigger());
    expect(mockImpactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

});
