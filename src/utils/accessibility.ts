import { AccessibilityInfo, findNodeHandle } from 'react-native';

type FocusableNativeNode = Parameters<typeof findNodeHandle>[0];

export function focusAccessibilityNode(node: FocusableNativeNode) {
  const handle = findNodeHandle(node);
  if (handle != null) {
    AccessibilityInfo.setAccessibilityFocus(handle);
  }
}
