import { View, Text, ScrollView, Image } from 'react-native';
import Constants from 'expo-constants';
import Svg, { Polyline } from 'react-native-svg';
import { SectionHeader } from '@/components/SectionHeader';
import { useI18n } from '@/src/i18n/index';
import { useThemeColors } from '@/hooks/use-theme-colors';

export default function AboutScreen() {
  const { t } = useI18n();
  const theme = useThemeColors();
  const features = [
    t('about.quickLog'),
    t('about.feature2'),
    t('about.bioTracking'),
    t('about.feature4'),
    t('about.csvExport'),
    t('about.feature6'),
  ];

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 32 }}>
      {/* Logo Header */}
      <View className="items-center py-6">
        <View
          className="w-20 h-20 rounded-2xl items-center justify-center mb-4 bg-primarySurface"
        >
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 60, height: 60, borderRadius: 12 }}
          />
        </View>
        <Text className="text-2xl font-extrabold text-text tracking-tight self-center">
          {t('home.title')}
        </Text>
        <Text className="text-xs font-semibold text-primaryText mt-1 self-center">
          {t('about.version', { version: appVersion })}
        </Text>
      </View>

      {/* Philosophy Section */}
      <View className="gap-3">
        <SectionHeader label={t('about.philosophy')} />
        <Text className="text-sm text-subtext leading-6">
          {t('about.philosophyText')}
        </Text>
      </View>

      <View className="border-b border-border/50" />

      {/* Features Section */}
      <View className="gap-2">
        <SectionHeader label={t('about.features')} />
        <View>
          {features.map((feature, i) => (
            <View
              key={i}
              className={`flex-row items-start gap-2 py-2 ${
                i === features.length - 1 ? '' : 'border-b border-border/50'
              }`}
            >
              <View className="mt-0.5">
                <Svg accessible={false} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <Polyline points="20 6 9 17 4 12" />
                </Svg>
              </View>
              <Text className="text-sm text-subtext leading-5 flex-1">
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="border-b border-border/50" />

      {/* Privacy Section */}
      <View className="gap-3">
        <SectionHeader label={t('about.privacy')} />
        <Text className="text-sm text-subtext leading-6">
          {t('about.privacyText')}
        </Text>
      </View>

      {/* Dev Footer */}
      <Text className="text-xs text-subtext text-center mt-6">
        {t('about.developer')}
      </Text>
    </ScrollView>
  );
}
