import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithAddress extends Request {
  address: string;
}

export const Address = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithAddress>();
    return request.address;
  },
);
