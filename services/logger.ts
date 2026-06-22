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
        console.log('[IronLog:debug]', ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        console.info('[IronLog:info]', ...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (isDev) {
        console.warn('[IronLog:warn]', ...args);
      }
    },
    error: (message: string, error?: unknown) => {
      if (isDev) {
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
