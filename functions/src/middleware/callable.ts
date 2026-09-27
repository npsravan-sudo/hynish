import { onCall, type CallableRequest, type CallableOptions } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { z, type ZodType } from 'zod';
import { REGION } from '../config/constants.js';
import { appError } from '../utils/errors.js';
import { logger } from 'firebase-functions/v2';

/**
 * Wrap a callable handler with: region, App Check (enforced in prod), Zod validation of the
 * payload, and consistent typed-error handling (Phase 2 §22, §34, §53, §54).
 */
export function defineCallable<TInput, TOutput>(
  schema: ZodType<TInput>,
  handler: (input: TInput, request: CallableRequest) => Promise<TOutput>,
  options?: Partial<CallableOptions>,
) {
  return onCall(
    {
      region: REGION,
      // App Check is enforced in production; the emulator/dev bypass is handled by the client
      // provider (SECURITY-ARCHITECTURE §10). Do not hard-code debug tokens here.
      enforceAppCheck: process.env.FUNCTIONS_EMULATOR === 'true' ? false : true,
      ...options,
    },
    async (request: CallableRequest) => {
      const parsed = schema.safeParse(request.data);
      if (!parsed.success) {
        throw appError('VALIDATION_FAILED', 'The request was invalid.', {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      try {
        return await handler(parsed.data, request);
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        // Never leak internal error details to the client.
        logger.error('callable_unhandled_error', { message: err instanceof Error ? err.message : 'unknown' });
        throw appError('INTERNAL', 'Something went wrong. Please try again.');
      }
    },
  );
}

export { z };
