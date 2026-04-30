import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { logger } from '@/services/logger';
import { getNestedValue } from '@/src/i18n/index';
import { pt } from '@/src/i18n/translations/pt';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches runtime errors in child components.
 * Shows a user-friendly fallback screen with a restart button.
 * Note: Uses direct translation lookup since class components cannot use hooks.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error(`ErrorBoundary caught: ${error.message}`, error);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 justify-center items-center bg-background p-6">
          <Text className="text-4xl mb-4">⚠️</Text>
          <Text className="text-text text-xl font-bold text-center mb-2">
            {getNestedValue(pt, 'common.errorBoundaryTitle') || 'Algo deu errado'}
          </Text>
          <Text className="text-subtext text-sm text-center mb-6 leading-5">
            {getNestedValue(pt, 'common.errorBoundaryDesc') || 'Ocorreu um erro inesperado. Tente novamente.'}
          </Text>
          {__DEV__ && this.state.error && (
            <View className="bg-card rounded-lg p-3 mb-4 w-full max-w-sm">
              <Text className="text-danger text-xs font-mono" numberOfLines={5}>
                {this.state.error.message}
              </Text>
            </View>
          )}
          <TouchableOpacity
            className="py-3 px-8 rounded-xl bg-primary"
            onPress={this.handleRestart}
          >
            <Text className="text-white font-bold text-base">{getNestedValue(pt, 'common.retry') || 'Tentar Novamente'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
