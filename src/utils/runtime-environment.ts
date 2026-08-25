export function supportsNativeNotifications(executionEnvironment: string): boolean {
  return executionEnvironment !== 'storeClient';
}
