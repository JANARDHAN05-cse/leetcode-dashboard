import rateLimit from 'express-rate-limit'

// Public endpoints limit: 100 requests per minute
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    },
  },
})

// Join requests limit: 5 submissions per 15 minutes per IP
export const requestSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Generous limit for local testing / demo
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests submitted. Please wait a few minutes before trying again.',
    },
  },
})

// Login attempts limit: max 10 attempts per 15 minutes per IP (elevated in test)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    },
  },
})

