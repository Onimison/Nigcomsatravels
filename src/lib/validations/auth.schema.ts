/**
 * Zod validation schemas for authentication.
 * PRD Section 2.1 — Passwordless OTP login for everyone.
 */

import { z } from 'zod'
import { OTP_CODE_LENGTH } from '@/lib/utils/constants'

/** Normalizes email input the same way at every entry point (send + verify). */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')

export const sendOtpSchema = z.object({
  email: emailField,
})

export const verifyOtpSchema = z.object({
  email: emailField,
  token: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), `Enter the ${OTP_CODE_LENGTH}-digit code`),
})

export type SendOtpInput = z.infer<typeof sendOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
