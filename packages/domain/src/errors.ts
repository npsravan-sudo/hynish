/**
 * Typed domain/application errors (§47). Framework-free (no Firebase). The client maps these
 * (and Cloud Functions HttpsError codes) to friendly messages; raw Firebase errors are never
 * surfaced directly to the UI.
 */
export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AUTHORIZATION'
  | 'ACCOUNTING'
  | 'INVENTORY'
  | 'DOCUMENT_NUMBER'
  | 'INTERNAL';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown> | undefined;
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION', message, details);
  }
}
export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', `${entity} not found${id ? `: ${id}` : ''}`, id ? { id } : undefined);
  }
}
export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
  }
}
export class AuthorizationError extends DomainError {
  constructor(message = 'Not authorized', details?: Record<string, unknown>) {
    super('AUTHORIZATION', message, details);
  }
}
export class AccountingError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('ACCOUNTING', message, details);
  }
}
export class InventoryError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVENTORY', message, details);
  }
}
export class DocumentNumberError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DOCUMENT_NUMBER', message, details);
  }
}
