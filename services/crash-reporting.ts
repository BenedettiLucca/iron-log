import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const isEnabled = Boolean(DSN) && !__DEV__;

export const initCrashReporting = () => {
  if (!DSN) {
    return;
  }

  Sentry.init({
    dsn: DSN,
    debug: __DEV__,
    enabled: isEnabled,
    tracesSampleRate: 1.0,
    _experiments: {
      profilesSampleRate: 1.0,
    },
  });
};

export const captureException = (error: unknown, context?: Record<string, unknown>) => {
  if (isEnabled) {
    Sentry.captureException(error, { extra: context });
  }
};

export const captureMessage = (message: string, context?: Record<string, unknown>) => {
  if (isEnabled) {
    Sentry.captureMessage(message, { extra: context });
  }
};
