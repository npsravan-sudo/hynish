import { logger } from 'firebase-functions/v2';

/**
 * Structured audit/log helper (SECURITY-ARCHITECTURE §14, Phase 2 §51).
 * NEVER logs secrets, tokens, passwords or credentials — only safe identifiers.
 */
export function logAudit(event: string, fields: Record<string, string | number | boolean | null>): void {
  logger.info(`audit:${event}`, fields);
}

export function logSecurity(event: string, fields: Record<string, string | number | boolean | null>): void {
  logger.warn(`security:${event}`, fields);
}
