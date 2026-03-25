/**
 * Error reporting stubs
 *
 * Sentry has been removed from this project. These no-op exports keep existing
 * call-sites compiling while all error reporting goes through the centralized
 * logger instead.
 */

import { logger } from './logger';

export const initSentry = () => {
  /* no-op */
};

export const captureError = (
  error: Error,
  context?: Record<string, any>,
  _level?: string
) => {
  logger.error('captureError', { message: error.message, ...context }, error);
};

export const captureMessage = (
  message: string,
  context?: Record<string, any>,
  _level?: string
) => {
  logger.info(message, context);
};

export const startTransaction = (
  _name: string,
  _op: string,
  _context?: Record<string, any>
) => null;

export const finishTransaction = (_transaction: any) => {
  /* no-op */
};

export const setUser = (_id: string, _email?: string, _username?: string) => {
  /* no-op */
};

export const clearUser = () => {
  /* no-op */
};
