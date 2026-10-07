import type { ColorSchemeName as RNColorSchemeName } from 'react-native';

// Module augmentations and compatibility shims for Expo SDK 57 / React Native 0.86
declare module 'expo-router' {
  export type Router = import('expo-router/build/imperative-api').ImperativeRouter;
}

declare module 'react-native' {
  interface StyleSheetStatic {
    absoluteFillObject: any;
  }
  namespace StyleSheet {
    export const absoluteFillObject: any;
  }
}

// Augment constants/colors to accept 'unspecified' introduced in RN 0.86
declare module '@/constants/colors' {
  export function getThemeColors(colorScheme: 'light' | 'dark' | 'unspecified' | null | undefined): any;
}

declare module './components/navigation/TabIcon' {
  import type { ColorValue } from 'react-native';
  export function TabIcon(props: { name: TabIconName; color: ColorValue | string; size?: number }): React.JSX.Element | null;
}

