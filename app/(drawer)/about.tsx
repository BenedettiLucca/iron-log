import { View, Text, ScrollView, Image } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../components/Card';

export default function AboutScreen() {
  return (
    <ScrollView className="flex-1 bg-background p-4" contentContainerStyle={{ gap: 16 }}>
      <Stack.Screen options={{ title: 'Sobre o Iron Log' }} />
      
      <View className="items-center py-8">
        <Image 
            source={require('../../assets/images/icon.png')} 
            style={{ width: 120, height: 120, borderRadius: 24 }}
        />
        <Text className="text-text text-4xl font-black mt-6 tracking-tight">Iron Log</Text>
        <Text className="text-primary font-bold uppercase tracking-widest text-xs mt-1">v3.1.2 • Polished Edition</Text>
      </View>

      <Card>
        <Text className="text-text font-bold text-lg mb-2">Filosofia Zero Atrito</Text>
        <Text className="text-subtext leading-6 mb-4">
            Projetado para quem levanta peso de verdade. Sem menus complexos, sem redes sociais, apenas foco total no treino e na progressão.
        </Text>

        <Text className="text-text font-bold text-lg mb-2">Recursos</Text>
        <Text className="text-subtext leading-6">
            • Registro Rápido de Séries & Cargas
            • Timer Pro com Background Mode
            • Bio-Tracking Completo (Peso, Medidas, Fotos)
            • Analytics de Performance (Strength Score, PRs, 1RM)
            • Exportação CSV & Backup SQLite
            • Design System &quot;Warm & Earthy&quot; com Tema Escuro
        </Text>
      </Card>

      <Card>
        <Text className="text-text font-bold text-lg mb-2">Privacidade Total</Text>
        <Text className="text-subtext leading-6">
            Seus dados são 100% seus. Utilizamos um banco de dados SQLite local. Nenhuma informação sai do seu dispositivo sem sua permissão.
        </Text>
      </Card>

      <View className="mt-8 mb-10 items-center">
        <Text className="text-subtext text-xs uppercase tracking-widest">
            Desenvolvido por Lucca Benedetti
        </Text>
      </View>
    </ScrollView>
  );
}