import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { ErrorCode, ErrorResponse } from "@raket/contracts";

type Mapped = {
  status: number;
  body: ErrorResponse;
};

function toMapped(exception: unknown, requestId: string): Mapped {
  const base = (code: ErrorCode, status: number, message: string, details?: Record<string, unknown>): Mapped => ({
    status,
    body: { code, message, requestId, ...(details ? { details } : {}) },
  });

  if (exception instanceof ZodError) {
    return base("VALIDATION_FAILED", 422, "Request validation failed", {
      issues: exception.issues,
    });
  }
  if (exception instanceof UnauthorizedException) {
    return base("UNAUTHENTICATED", 401, exception.message);
  }
  if (exception instanceof ForbiddenException) {
    return base("FORBIDDEN", 403, exception.message);
  }
  if (exception instanceof NotFoundException) {
    return base("NOT_FOUND", 404, exception.message);
  }
  if (exception instanceof ConflictException) {
    return base("CONFLICT", 409, exception.message);
  }
  if (exception instanceof HttpException) {
    return base("INTERNAL", exception.getStatus(), exception.message);
  }
  return base(
    "INTERNAL",
    500,
    exception instanceof Error ? exception.message : "Internal server error",
  );
}

@Catch()
export class TsRestExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    const mapped = toMapped(exception, requestId);
    res.status(mapped.status).json(mapped.body);
  }
}
