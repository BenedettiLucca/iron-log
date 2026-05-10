import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Button } from './Button';
import { SkeletonList } from './Skeleton';
import { Colors } from '@/constants/colors';
import { useI18n } from '../src/i18n/index';

interface LoadingStateProps {
  title?: string;
  type?: 'centered' | 'list';
}

export function LoadingState({ title, type = 'centered' }: LoadingStateProps) {
  const { t } = useI18n();

  if (type === 'list') {
    return (
      <View className="flex-1 p-4">
        {title && <Text className="text-text text-xl font-bold mb-4">{title}</Text>}
        <SkeletonList count={5} />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-8">
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text className="text-subtext mt-4 text-center">
        {title || t('states.loadingBody')}
      </Text>
    </View>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  icon = '⚠️',
}: ErrorStateProps) {
  const { t } = useI18n();

  return (
    <View className="flex-1 justify-center items-center p-8">
      <Text className="text-6xl mb-6">{icon}</Text>
      <Text className="text-text text-xl font-bold text-center mb-3">
        {title || t('states.errorTitle')}
      </Text>
      <Text className="text-subtext text-sm text-center mb-8 leading-6">
        {message || t('states.errorBody')}
      </Text>
      {onRetry && (
        <Button
          title={t('states.retry')}
          onPress={onRetry}
          variant="secondary"
          className="min-w-[160px]"
        />
      )}
    </View>
  );
}
