import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { Colors, getThemeColors } from '../../constants/colors';
import { useI18n } from '../../src/i18n/index';
import { TabIcon } from '../../components/navigation/TabIcon';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const { t } = useI18n();
  const themeColors = getThemeColors(colorScheme);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.primary,
          },
          headerTintColor: Colors.onPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          tabBarActiveTintColor: themeColors.primaryText,
          tabBarInactiveTintColor: themeColors.subtext,
          tabBarStyle: {
            backgroundColor: themeColors.card,
            borderTopColor: themeColors.border,
            borderTopWidth: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('home.title'),
            tabBarLabel: t('tabs.home'),
            tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="routines"
          options={{
            title: t('routines.title'),
            tabBarLabel: t('tabs.routines'),
            tabBarIcon: ({ color, size }) => <TabIcon name="workout" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('drawer.history'),
            tabBarLabel: t('tabs.history'),
            tabBarIcon: ({ color, size }) => <TabIcon name="history" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="bio"
          options={{
            title: t('drawer.bio'),
            tabBarLabel: t('tabs.bio'),
            tabBarIcon: ({ color, size }) => <TabIcon name="bio" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('settings.title'),
            tabBarLabel: t('tabs.settings'),
            tabBarIcon: ({ color, size }) => <TabIcon name="settings" color={color} size={size} />,
          }}
        />
      </Tabs>
    </>
  );
}
