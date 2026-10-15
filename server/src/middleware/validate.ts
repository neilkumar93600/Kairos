import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { HttpError } from "../lib/errors";

/** Parses req.body with a zod schema and replaces it with the typed result. */
export function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(new HttpError(422, "invalid_body", "Some fields are invalid", parsed.error.issues));
    }
    req.body = parsed.data;
    next();
  };
}

export function parseParam<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "invalid_param", "Invalid path or query parameter", parsed.error.issues);
  return parsed.data;
}
