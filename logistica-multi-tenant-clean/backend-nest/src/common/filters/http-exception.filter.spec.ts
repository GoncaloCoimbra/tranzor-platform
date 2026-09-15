import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (exception: unknown) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      method: 'GET',
      url: '/api/test',
      originalUrl: '/api/test?value=1',
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(exception, host);

    return { json, status };
  };

  it.each([
    [400, new BadRequestException(['field must be valid']), 'Bad Request'],
    [404, new NotFoundException('Resource not found'), 'Not Found'],
    [409, new ConflictException('Insufficient stock'), 'Conflict'],
  ])(
    'returns the common error shape for HTTP %s',
    (statusCode, exception, errorName) => {
      const { json, status } = createHost(exception);

      expect(status).toHaveBeenCalledWith(statusCode);
      expect(json).toHaveBeenCalledWith({
        statusCode,
        message: expect.anything(),
        error: errorName,
        timestamp: expect.any(String),
        path: '/api/test?value=1',
      });
    },
  );
});