import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let body: Record<string, unknown> = {
      statusCode: 500,
      message: 'Internal server error',
      path: request.url,
    };

    if (exception instanceof ZodError) {
      status = 400;
      body = {
        statusCode: 400,
        message: 'Validation failed',
        errors: exception.flatten().fieldErrors,
        path: request.url,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = typeof resp === 'string' ? { statusCode: status, message: resp, path: request.url } : { ...(resp as object), path: request.url };
    } else {
      this.logger.error(exception);
    }

    response.status(status).send(body);
  }
}