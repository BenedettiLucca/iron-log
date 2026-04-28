// Define global variables for React Native
global.__DEV__ = true;

// Silence console.log/error during tests unless debugging
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock NativeWind
jest.mock('nativewind', () => ({
  setup: jest.fn(),
}));

// Mock Expo modules early
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidNotificationPriority: {
    HIGH: 2,
  },
  SchedulableTriggerInputTypes: {
    DATE: 'date',
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: {
    Images: 'images',
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/tmp/',
  copyAsync: jest.fn(),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(() => [{}, {}, jest.fn()]),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openBrowserAsync: jest.fn(),
  dismissBrowserAsync: jest.fn(),
}));

jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useAnimatedStyle: jest.fn((fn) => fn),
  withSpring: jest.fn((val, config) => val),
  withTiming: jest.fn((val, config) => val),
  withRepeat: jest.fn((val) => val),
  withSequence: jest.fn((...args) => args[args.length - 1]),
  FadeIn: 'FadeIn',
  FadeInDown: 'FadeInDown',
  ZoomIn: 'ZoomIn',
  createAnimatedComponent: jest.fn((comp) => comp),
}));

jest.mock('react-native-gesture-handler', () => ({
  Swipeable: 'Swipeable',
  GestureHandlerRootView: 'GestureHandlerRootView',
  Rect: 'Rect',
  TouchableOpacity: 'TouchableOpacity',
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
  useFocusEffect: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useFocusEffect: jest.fn(),
  Stack: { Screen: jest.fn() },
}));

