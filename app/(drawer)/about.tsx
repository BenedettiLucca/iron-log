import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../components/Card';
import { useI18n } from '../../src/i18n/index';

const features = [
  t('about.quickLog'),
  'Timer Pro com Background Mode',
  t('about.bioTracking'),
  'Analytics de Performance (Strength Score, PRs, 1RM)',
  t('about.csvExport'),
  'Design System "Warm & Earthy" com Tema Escuro',
];

export default function AboutScreen() {
  const { t } = useI18n();
  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: t('about.title') }} />
      
      <View className="items-center py-6">
        <Image 
            source={require('../../assets/images/icon.png')} 
            style={{ width: 100, height: 100, borderRadius: 20 }}
        />
        <Text className="text-text text-3xl font-black mt-4 tracking-tight">{t("drawer.dashboard")}</Text>
        <Text className="text-primary font-bold uppercase tracking-widest text-xs mt-1">{t("about.version", { version: "3.3.0" })}</Text>
      </View>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">{t("about.philosophy")}</Text>
          <Text className="text-subtext text-sm leading-5 mb-4">
            Projetado para quem levanta peso de verdade. Sem menus complexos, sem redes sociais, apenas foco total no treino e na progressão.
          </Text>

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
          <Text className="text-subtext text-sm leading-5">
            Seus dados são 100% seus. Utilizamos um banco de dados SQLite local. Nenhuma informação sai do seu dispositivo sem sua permissão.
          </Text>
        </View>
      </Card>

      <View className="mt-4 items-center">
        <Text className="text-subtext text-xs uppercase tracking-widest">
          Desenvolvido por Lucca Benedetti
        </Text>
      </View>
    </ScrollView>
  );
}
