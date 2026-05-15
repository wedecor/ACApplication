import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators';
import { assertWebhookAuth } from '../../common/security/webhook-auth';
import { NotificationWebhooksService } from './notification-webhooks.service';

@ApiTags('notification-webhooks')
@Controller({ path: 'notifications/webhooks', version: '1' })
export class NotificationWebhooksController {
  constructor(private readonly webhooks: NotificationWebhooksService) {}

  @Public()
  @Post('twilio')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Twilio SMS delivery status callback' })
  async twilio(
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Req() req: FastifyRequest,
  ): Promise<void> {
    const url = `${process.env['API_URL'] ?? ''}${req.url}`;
    assertWebhookAuth(this.webhooks.verifyTwilioSignature(url, body, signature), 'Twilio');
    await this.webhooks.handleTwilioStatus(body);
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend email delivery events' })
  async resend(
    @Body() body: { type?: string; data?: { email_id?: string } },
    @Headers('svix-signature') signature: string | undefined,
    @Req() req: FastifyRequest & { rawBody?: Buffer },
  ): Promise<void> {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    assertWebhookAuth(this.webhooks.verifyResendSignature(raw, signature), 'Resend');
    await this.webhooks.handleResendEvent(body);
  }

  @Public()
  @Post('expo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Expo push receipt batch' })
  async expo(
    @Body()
    body: Array<{ status: string; id?: string; message?: string; details?: unknown }>,
    @Headers('x-expo-signature') signature: string | undefined,
    @Req() req: FastifyRequest & { rawBody?: Buffer },
  ): Promise<void> {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    assertWebhookAuth(this.webhooks.verifyExpoSignature(raw, signature), 'Expo');
    await this.webhooks.handleExpoReceipts(body);
  }

  @Public()
  @Post('whatsapp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'WhatsApp Cloud API delivery status updates' })
  async whatsapp(
    @Body() body: Parameters<NotificationWebhooksService['handleWhatsAppStatus']>[0],
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: FastifyRequest & { rawBody?: Buffer },
  ): Promise<void> {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    assertWebhookAuth(this.webhooks.verifyWhatsAppSignature(raw, signature), 'WhatsApp');
    await this.webhooks.handleWhatsAppStatus(body);
  }
}
