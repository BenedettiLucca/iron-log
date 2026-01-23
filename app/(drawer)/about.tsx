import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';

export default function AboutScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-6">
      <Stack.Screen options={{ title: 'Sobre o Iron Log' }} />
      
      <View className="items-center mb-8">
        <Image 
            source={require('../../assets/images/icon.png')} 
            style={{ width: 100, height: 100, borderRadius: 20 }}
        />
        <Text className="text-text text-3xl font-bold mt-4">Iron Log</Text>
        <Text className="text-subtext">Versão 2.3 (Warm Release)</Text>
      </View>

      <View className="bg-card p-6 rounded-2xl border border-border mb-6">
        <Text className="text-text font-bold text-lg mb-2">Filosofia Zero Atrito</Text>
        <Text className="text-subtext leading-6 mb-4">
            Projetado para quem levanta peso de verdade. Sem menus complexos, sem redes sociais, apenas foco total no treino e na progressão.
        </Text>

        <Text className="text-text font-bold text-lg mb-2">Recursos Premium</Text>
        <Text className="text-subtext leading-6">
            • Timer Pro com Background Mode
            • Bio-Tracking com Gráficos e Fotos
            • Importação Inteligente de Treinos (IA)
            • Heatmap de Consistência
        </Text>
      </View>

      <View className="bg-card p-6 rounded-2xl border border-border">
        <Text className="text-text font-bold text-lg mb-2">Privacidade</Text>
        <Text className="text-subtext leading-6">
            Seus dados são seus. O banco de dados SQLite é local e criptografado pelo sistema operacional. Nenhuma informação sai do seu dispositivo.
        </Text>
      </View>

      <Text className="text-center text-subtext text-xs mt-10 mb-10">
          Desenvolvido com ❤️ para a comunidade de força.
      </Text>
    </ScrollView>
  );
}