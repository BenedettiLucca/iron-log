import Constants from 'expo-constants';

export function getExecutionEnvironment(): string {
  const env =
    Constants?.executionEnvironment ??
    (Constants as { default?: { executionEnvironment?: string } })?.default
      ?.executionEnvironment;
  return typeof env === 'string' ? env : 'storeClient';
}

export function supportsNativeNotifications(
  executionEnvironment: string = getExecutionEnvironment()
): boolean {
  return executionEnvironment !== 'storeClient';
}

export function isExpoGo(
  executionEnvironment: string = getExecutionEnvironment()
): boolean {
  return !supportsNativeNotifications(executionEnvironment);
}
