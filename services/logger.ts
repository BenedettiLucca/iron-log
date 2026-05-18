/**
 * Structured Logger for Iron Log
 * — Debug logs are silenced in production
 * — Errors are forwarded to crash reporting when configured
 */

import { captureException, captureMessage } from './crash-reporting';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (message: string, error?: unknown) => void;
}

function createLogger(): Logger {
  const isDev = __DEV__;

  return {
    debug: (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log('[IronLog:debug]', ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.info('[IronLog:info]', ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.warn('[IronLog:warn]', ...args);
      }
    },
    error: (message: string, error?: unknown) => {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.error('[IronLog:error]', message, error);
      }
      
      if (error) {
        captureException(error, { message });
      } else {
        captureMessage(message);
      }
    },
  };
}

export const logger = createLogger();
