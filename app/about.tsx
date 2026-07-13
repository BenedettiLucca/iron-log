import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import Svg, { Polyline } from 'react-native-svg';
import { Card } from '@/components/Card';
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
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('about.title') }} />
      
      {/* Logo Header */}
      <View className="items-center py-6">
        <View
          style={{ backgroundColor: 'rgba(224,122,95,0.08)' }}
          className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
        >
          <Image
            source={require('../assets/images/icon.png')}
            style={{ width: 60, height: 60, borderRadius: 12 }}
          />
        </View>
        <Text className="text-2xl font-extrabold text-text tracking-tight self-center">
          {t('about.title')}
        </Text>
        <Text className="text-xs font-bold text-primaryText uppercase tracking-widest mt-1 self-center">
          {t('about.version', { version: appVersion })}
        </Text>
      </View>

      {/* Philosophy Card */}
      <Card contentPadding={false}>
        <View className="p-3 gap-3">
          <SectionHeader label={t('about.philosophy')} />
          <Text className="text-sm text-subtext leading-6">
            {t('about.philosophyText')}
          </Text>
        </View>
      </Card>

      {/* Features Card */}
      <Card contentPadding={false}>
        <View className="p-3 gap-2">
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
                  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.primaryText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      </Card>

      {/* Privacy Card */}
      <Card contentPadding={false}>
        <View className="p-3 gap-3">
          <SectionHeader label={t('about.privacy')} />
          <Text className="text-sm text-subtext leading-6">
            {t('about.privacyText')}
          </Text>
        </View>
      </Card>

      {/* Dev Footer */}
      <Text className="text-xs text-subtext text-center mt-6">
        {t('about.developer')}
      </Text>
    </ScrollView>
  );
}
