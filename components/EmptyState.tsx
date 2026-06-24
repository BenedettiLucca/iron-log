import { View, Text, TouchableOpacity } from 'react-native';

import { Card } from './Card';
import { useI18n } from '../src/i18n/index';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Consistent empty state component for screens with no data
 */
export function EmptyState({
  icon = '📋',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { t } = useI18n();

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
  };

  return (
    <View className="flex-1 justify-center items-center px-8 py-12">
      <Text className="text-6xl mb-6">{icon}</Text>
      <Text className="text-text text-xl font-bold text-center mb-3">{title}</Text>
      {description && (
        <Text className="text-subtext text-sm text-center mb-8 leading-6">{description}</Text>
      )}
      {(actionLabel || onAction) && (
        <TouchableOpacity
          onPress={handleAction}
          className="bg-primary/10 border-2 border-primary/30 rounded-2xl px-6 py-3"
        >
          <Text className="text-primary font-bold text-sm uppercase tracking-wider">
            {actionLabel || t('common.add')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Inline empty state for use within cards
 */
interface InlineEmptyStateProps {
  icon?: string;
  title: string;
}

export function InlineEmptyState({ icon = '📭', title }: InlineEmptyStateProps) {
  return (
    <Card>
      <View className="py-8 items-center">
        <Text className="text-4xl mb-3">{icon}</Text>
        <Text className="text-subtext text-sm font-semibold text-center">{title}</Text>
      </View>
    </Card>
  );
}
