import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { loadMt5TcpConfig } from './mt5-config.js';
import { MessageRouter } from './message-router.js';
import { Mt5ProtocolValidator } from './protocol-validator.js';

@Controller('mt5')
export class Mt5HttpController {
  private readonly config = loadMt5TcpConfig();

  constructor(
    private readonly validator: Mt5ProtocolValidator,
    private readonly router: MessageRouter,
  ) {}

  @Post('ingest')
  @HttpCode(200)
  ingest(
    @Body() body: unknown,
    @Headers('x-mt5-auth-token') headerToken?: string,
  ): { accepted: true; messageId: string } {
    const result = this.validator.validate(body);
    if (!result.valid) {
      throw new UnauthorizedException(result.error);
    }

    const token = headerToken || (result.message.type === 'AUTH' ? result.message.token : undefined);
    if (!this.config.authToken || token !== this.config.authToken) {
      throw new UnauthorizedException('AUTHENTICATION_FAILED');
    }

    if (result.message.type === 'AUTH') {
      return { accepted: true, messageId: result.message.messageId };
    }

    this.router.route(result.message);
    return { accepted: true, messageId: result.message.messageId };
  }
}
