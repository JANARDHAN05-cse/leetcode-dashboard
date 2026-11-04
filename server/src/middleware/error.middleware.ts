import type { Request, Response, NextFunction } from 'express'
import { RequestValidationError, RequestConflictError } from '../services/request.service'
import { AdminActionError } from '../services/admin.service'

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Admin action error (400, 401, 404, 409, 502)
  if (err instanceof AdminActionError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    })
  }

  // Client validation error (400)
  if (err instanceof RequestValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: err.code || 'VALIDATION_ERROR',
        message: err.message,
        fields: err.field ? { [err.field]: err.message } : undefined,
      },
    })
  }

  // Conflict error (409)
  if (err instanceof RequestConflictError) {
    return res.status(409).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    })
  }

  // Generic server error (500) — log full stack server-side, return safe message to client
  console.error('[UNHANDLED_ERROR]', err)
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred.',
    },
  })
}

