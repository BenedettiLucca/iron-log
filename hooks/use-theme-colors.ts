import { useColorScheme } from 'react-native';
import { getThemeColors } from '@/constants/colors';

export function useThemeColors() {
  return getThemeColors(useColorScheme());
}
