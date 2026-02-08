import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from '../../hooks/use-color-scheme';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#F4F1DE' }}>
      <Drawer screenOptions={{
        headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#E07A5F' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        drawerStyle: { backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#F4F1DE' },
        drawerActiveTintColor: '#E07A5F',
        drawerInactiveTintColor: colorScheme === 'dark' ? '#fff' : '#000',
        sceneContainerStyle: { backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#F4F1DE' },
        safeAreaInsets: { top: false, bottom: false, left: false, right: false },
      }}>
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
