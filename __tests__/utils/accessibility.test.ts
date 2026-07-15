import { focusAccessibilityNode } from '@/src/utils/accessibility';

const mockFindNodeHandle = jest.fn();
const mockSetAccessibilityFocus = jest.fn();

jest.mock('react-native', () => ({
  findNodeHandle: (...args: unknown[]) => mockFindNodeHandle(...args),
  AccessibilityInfo: {
    setAccessibilityFocus: (...args: unknown[]) => mockSetAccessibilityFocus(...args),
  },
}));

describe('focusAccessibilityNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('focuses a mounted native node', () => {
    const node = {} as import('react').Component;
    mockFindNodeHandle.mockReturnValue(42);

    focusAccessibilityNode(node);

    expect(mockFindNodeHandle).toHaveBeenCalledWith(node);
    expect(mockSetAccessibilityFocus).toHaveBeenCalledWith(42);
  });

  it('does nothing when there is no mounted native handle', () => {
    mockFindNodeHandle.mockReturnValue(null);

    focusAccessibilityNode(null);

    expect(mockSetAccessibilityFocus).not.toHaveBeenCalled();
  });
});
