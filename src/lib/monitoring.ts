/**
 * Monitoring stubs — Sentry has been removed.
 * All reporting goes through the centralized logger.
 */

import { logger } from './logger';

export function initSentry() {
  /* no-op */
}

export function reportError(error: Error, context?: Record<string, any>) {
  logger.error('reportError', { message: error.message, ...context }, error);
}

export function reportMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) {
  logger.info(`[${level.toUpperCase()}] ${message}`, context);
}

export function setUserContext(_user: { id: string; email?: string; role?: string; name?: string }) {
  /* no-op */
}

export function startTransaction(_name: string, _op: string) {
  return null;
}

export function addBreadcrumb(
  _message: string,
  _category: string,
  _level: 'info' | 'warning' | 'error' = 'info'
) {
  /* no-op */
}
