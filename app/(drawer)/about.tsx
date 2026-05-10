import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../components/Card';
import { useI18n } from '../../src/i18n/index';

export default function AboutScreen() {
  const { t } = useI18n();
  const features = [
    t('about.quickLog'),
    t('about.feature2'),
    t('about.bioTracking'),
    t('about.feature4'),
    t('about.csvExport'),
    t('about.feature6'),
  ];
  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('about.title') }} />
      
      <View className="items-center py-6">
        <Image 
            source={require('../../assets/images/icon.png')} 
            style={{ width: 100, height: 100, borderRadius: 20 }}
        />
        <Text className="text-text text-3xl font-black mt-4 tracking-tight">{t("drawer.dashboard")}</Text>
        <Text className="text-primary font-bold uppercase tracking-widest text-xs mt-1">{t("about.version", { version: "3.11.0" })}</Text>
      </View>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">{t("about.philosophy")}</Text>
          <Text className="text-subtext text-sm leading-5 mb-4">{t('about.philosophyText')}</Text>

          <Text className="text-text font-bold text-base mb-2">{t("about.features")}</Text>
          <View className="gap-1.5">
            {features.map((feature, i) => (
              <View key={i} className="flex-row items-start">
                <Text className="text-primary mr-2 text-sm">•</Text>
                <Text className="text-subtext text-sm leading-5 flex-1">{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">{t("about.privacy")}</Text>
          <Text className="text-subtext text-sm leading-5">{t('about.privacyText')}</Text>
        </View>
      </Card>

      <View className="mt-4 items-center">
        <Text className="text-subtext text-xs uppercase tracking-widest">{t('about.developer')}</Text>
      </View>
    </ScrollView>
  );
}

