/**
 * Centralized error handling and logging system
 */

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  
  // Payment errors
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PAYMENT_METHOD_INVALID = 'PAYMENT_METHOD_INVALID',
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',
  
  // File upload errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
}

export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
  userId?: string;
  stack?: string;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly userId?: string;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>,
    requestId?: string,
    userId?: string,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
    this.userId = userId;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
      userId: this.userId,
      stack: this.stack,
    };
  }
}

// Predefined error creators
export const createAuthError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.UNAUTHORIZED, message, 401, details, requestId, userId);

export const createForbiddenError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.FORBIDDEN, message, 403, details, requestId, userId);

export const createValidationError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details, requestId, userId);

export const createNotFoundError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.NOT_FOUND, message, 404, details, requestId, userId);

export const createConflictError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.ALREADY_EXISTS, message, 409, details, requestId, userId);

export const createPaymentError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.PAYMENT_FAILED, message, 402, details, requestId, userId);

export const createUploadError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.UPLOAD_FAILED, message, 400, details, requestId, userId);

export const createInternalError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details, requestId, userId, false);

export const createDatabaseError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.DATABASE_ERROR, message, 500, details, requestId, userId, false);

export const createExternalServiceError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, message, 503, details, requestId, userId);

export const createRateLimitError = (message: string, details?: Record<string, any>, requestId?: string, userId?: string) =>
  new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429, details, requestId, userId);

// Error type guards
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isOperationalError = (error: any): boolean => {
  return isAppError(error) && error.isOperational;
};

// User-friendly error messages
export const getUserFriendlyMessage = (error: AppError): string => {
  const friendlyMessages: Record<ErrorCode, string> = {
    [ErrorCode.UNAUTHORIZED]: 'Please log in to access this resource.',
    [ErrorCode.FORBIDDEN]: 'You don\'t have permission to perform this action.',
    [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
    [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
    [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
    [ErrorCode.INVALID_INPUT]: 'The information provided is not valid.',
    [ErrorCode.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
    [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
    [ErrorCode.ALREADY_EXISTS]: 'This resource already exists.',
    [ErrorCode.RESOURCE_CONFLICT]: 'There was a conflict with your request.',
    [ErrorCode.PAYMENT_FAILED]: 'Payment could not be processed. Please try again.',
    [ErrorCode.INSUFFICIENT_FUNDS]: 'Insufficient funds. Please check your payment method.',
    [ErrorCode.PAYMENT_METHOD_INVALID]: 'Invalid payment method. Please update your payment information.',
    [ErrorCode.SUBSCRIPTION_ERROR]: 'There was an issue with your subscription. Please contact support.',
    [ErrorCode.FILE_TOO_LARGE]: 'File is too large. Please choose a smaller file.',
    [ErrorCode.INVALID_FILE_TYPE]: 'File type not supported. Please choose a different file.',
    [ErrorCode.UPLOAD_FAILED]: 'File upload failed. Please try again.',
    [ErrorCode.INTERNAL_SERVER_ERROR]: 'Something went wrong on our end. Please try again later.',
    [ErrorCode.DATABASE_ERROR]: 'Database error occurred. Please try again later.',
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service is temporarily unavailable. Please try again later.',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again.',
  };

  return friendlyMessages[error.code] || 'An unexpected error occurred. Please try again.';
};