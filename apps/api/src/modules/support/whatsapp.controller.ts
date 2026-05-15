import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

type Request = FastifyRequest & { rawBody?: Buffer | string };

import { Public } from '../../common/decorators';
import { WhatsAppInboxService } from './whatsapp-inbox.service';

/**
 * Public WhatsApp Cloud API webhook endpoints.
 *
 * - GET  /webhooks/whatsapp  — Meta's subscription handshake.
 * - POST /webhooks/whatsapp  — message + status callbacks.
 *
 * The raw body is recovered from `req.rawBody` (set by the global Fastify
 * raw-body parser); we need the bytes verbatim so we can verify the HMAC
 * signature.
 */
@ApiTags('webhooks:whatsapp')
@Controller({ path: 'webhooks/whatsapp', version: '1' })
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly inbox: WhatsAppInboxService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Meta GET handshake — echoes back the challenge.' })
  verify(@Query() query: Record<string, string>): string {
    const challenge = this.inbox.verifySubscription(query);
    if (!challenge) {
      throw new BadRequestException('Verification failed');
    }
    return challenge;
  }

  @Public()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Meta webhook — inbound messages + delivery receipts.' })
  async webhook(
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: Request,
    @Body() body: unknown,
  ): Promise<{ messages: number; statuses: number }> {
    const rawBody =
      ((req as unknown as { rawBody?: string | Buffer }).rawBody as string | Buffer | undefined) ??
      JSON.stringify(body);
    const rawString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    if (!this.inbox.verifySignature(rawString, signature)) {
      this.logger.warn('Rejected WhatsApp webhook with invalid signature');
      throw new BadRequestException('Invalid signature');
    }
    return this.inbox.handleWebhook(body);
  }
}
