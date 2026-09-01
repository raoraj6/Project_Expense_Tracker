import { HttpError } from './error.js';

/**
 * Validates one part of the request against a Zod schema and replaces it with
 * the parsed (coerced, stripped) result.
 */
export function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        new HttpError(
          422,
          'Validation failed',
          result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          }))
        )
      );
    }
    req[part] = result.data;
    next();
  };
}
