import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { MulterError } from "multer";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { ErrorCode, ErrorResponse } from "@raket/contracts";

type Mapped = {
  status: number;
  body: ErrorResponse;
};

function toMapped(exception: unknown, requestId: string): Mapped {
  const base = (
    code: ErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ): Mapped => ({
    status,
    body: { code, message, requestId, ...(details ? { details } : {}) },
  });

  if (exception instanceof ZodError) {
    return base("VALIDATION_FAILED", 422, "Request validation failed", {
      issues: exception.issues,
    });
  }
  if (exception instanceof MulterError) {
    // LIMIT_FILE_SIZE is the only one we expect in practice (per-endpoint
    // multer `limits.fileSize`). Map it to 413 so clients can show a clear
    // "file too large" message. Other multer errors are malformed-request bugs.
    if (exception.code === "LIMIT_FILE_SIZE") {
      return base("FILE_TOO_LARGE", 413, "Uploaded file is too large");
    }
    return base("VALIDATION_FAILED", 422, exception.message);
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
    const status = exception.getStatus();
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
      // Nest's FileInterceptor wraps multer's LIMIT_FILE_SIZE in a
      // PayloadTooLargeException before our MulterError branch can see it.
      return base("FILE_TOO_LARGE", status, exception.message);
    }
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return base("RATE_LIMITED", status, exception.message);
    }
    return base("INTERNAL", status, exception.message);
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
