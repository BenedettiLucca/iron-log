import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Colors } from '@/constants/colors';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground }}>
      <Drawer screenOptions={{
        headerStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        drawerStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground },
        drawerActiveTintColor: Colors.primary,
        drawerInactiveTintColor: colorScheme === 'dark' ? '#fff' : '#000',
      } }>
        <Drawer.Screen 
          name="index" 
          options={{ 
            title: 'Iron Log', 
            drawerLabel: 'Dashboard' 
          }} 
        />
        <Drawer.Screen 
          name="bio/index" 
          options={{ 
            title: 'Bio & Evolução', 
            drawerLabel: 'Bio & Corpo' 
          }} 
        />
        <Drawer.Screen
          name="bio/evolution"
          options={{
            drawerItemStyle: { display: 'none' }
          }}
        />
        <Drawer.Screen
          name="bio/goals"
          options={{
            title: 'Metas & Objetivos',
            drawerLabel: 'Minhas Metas'
          }}
        />
        <Drawer.Screen 
          name="routines/index" 
          options={{ 
            title: 'Minhas Rotinas', 
            drawerLabel: 'Gerenciar Rotinas' 
          }} 
        />
        <Drawer.Screen 
          name="routines/editor" 
          options={{ 
            title: 'Editor de Rotina', 
            drawerItemStyle: { display: 'none' } 
          }} 
        />
        <Drawer.Screen
          name="routines/templates"
          options={{
            drawerItemStyle: { display: 'none' }
          }}
        />
        <Drawer.Screen
          name="bio/analytics"
          options={{
            drawerItemStyle: { display: 'none' }
          }}
        />
        <Drawer.Screen 
          name="history/index" 
          options={{ 
            title: 'Histórico', 
            drawerLabel: 'Calendário' 
          }} 
        />
        <Drawer.Screen 
          name="about" 
          options={{ 
            title: 'Sobre', 
            drawerLabel: 'Sobre o App' 
          }} 
        />
        <Drawer.Screen 
          name="settings" 
          options={{ 
            title: 'Dados & Backup', 
            drawerLabel: 'Backup & Dados' 
          }} 
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
