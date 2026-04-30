import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Colors } from '@/constants/colors';
import { useI18n } from '../../src/i18n/index';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  const { t } = useI18n();

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
            title: t('home.title'),
            drawerLabel: t('drawer.dashboard')
          }}
        />
        <Drawer.Screen
          name="bio/index"
          options={{
            title: t('drawer.bioEvolution'),
            drawerLabel: t('drawer.bio')
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
            title: t('goals.title'),
            drawerLabel: t('drawer.goals')
          }}
        />
        <Drawer.Screen
          name="routines/index"
          options={{
            title: t('routines.title'),
            drawerLabel: t('drawer.routines')
          }}
        />
        <Drawer.Screen
          name="routines/editor"
          options={{
            title: t('drawer.editorTitle'),
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
          name="bio/checkin"
          options={{
            drawerItemStyle: { display: 'none' }
          }}
        />
        <Drawer.Screen
          name="history/index"
          options={{
            title: t('drawer.history'),
            drawerLabel: t('drawer.history')
          }}
        />
        <Drawer.Screen
          name="about"
          options={{
            title: t('drawer.about'),
            drawerLabel: t('drawer.about')
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            title: t('settings.title'),
            drawerLabel: t('drawer.settings')
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}
