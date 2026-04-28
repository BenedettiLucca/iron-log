import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../components/Card';

const features = [
  'Registro Rápido de Séries & Cargas',
  'Timer Pro com Background Mode',
  'Bio-Tracking Completo (Peso, Medidas, Fotos)',
  'Analytics de Performance (Strength Score, PRs, 1RM)',
  'Exportação CSV & Backup SQLite',
  'Design System "Warm & Earthy" com Tema Escuro',
];

export default function AboutScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 12, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: 'Sobre o Iron Log' }} />
      
      <View className="items-center py-6">
        <Image 
            source={require('../../assets/images/icon.png')} 
            style={{ width: 100, height: 100, borderRadius: 20 }}
        />
        <Text className="text-text text-3xl font-black mt-4 tracking-tight">Iron Log</Text>
        <Text className="text-primary font-bold uppercase tracking-widest text-xs mt-1">v3.1.2 • Polished Edition</Text>
      </View>

      <Card contentPadding={false}>
        <View className="p-3">
          <Text className="text-text font-bold text-base mb-1.5">Filosofia Zero Atrito</Text>
          <Text className="text-subtext text-sm leading-5 mb-4">
            Projetado para quem levanta peso de verdade. Sem menus complexos, sem redes sociais, apenas foco total no treino e na progressão.
          </Text>

          <Text className="text-text font-bold text-base mb-2">Recursos</Text>
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
          <Text className="text-text font-bold text-base mb-1.5">Privacidade Total</Text>
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
