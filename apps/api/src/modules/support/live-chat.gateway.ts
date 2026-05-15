import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';

import { ConversationChannel } from '@ac/types';

import { ConversationsService } from './conversations.service';

/**
 * Live-chat gateway for visitor / in-app chat. Mounted on the same path
 * as the main realtime gateway (`/ws`) so we share auth + sockets.
 * Anonymous web-chat is supported via a separate `web-chat:join` event
 * that creates a Conversation keyed on the cookie session id.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: '/ws',
  transports: ['websocket'],
})
export class LiveChatGateway {
  constructor(private readonly conversations: ConversationsService) {}

  /**
   * Anonymous web-chat visitors send `web-chat:join` with a session id.
   * The server creates / re-opens the Conversation and replies with the
   * room name to subscribe to.
   */
  @SubscribeMessage('web-chat:join')
  async handleWebChatJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { sessionId: string; tenantId: string; name?: string; email?: string; phone?: string },
  ): Promise<{ ok: true; conversationId: string }> {
    const r = await this.conversations.ingestInbound({
      tenantId: body.tenantId,
      channel: ConversationChannel.WEB_CHAT,
      threadIdentifier: body.sessionId,
      body: '[Session opened]',
      customerLookupPhone: body.phone,
      customerLookupEmail: body.email,
      fromName: body.name,
      rawPayload: { sessionId: body.sessionId },
    });
    await client.join(`conversation:${r.conversationId}`);
    return { ok: true, conversationId: r.conversationId };
  }

  /**
   * Inbound visitor message. The server persists it and broadcasts to
   * the conversation room — agent UIs are subscribed via the main
   * gateway's `subscribe` op.
   */
  @SubscribeMessage('web-chat:message')
  async handleWebChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { tenantId: string; sessionId: string; body: string },
  ): Promise<{ ok: true; messageId: string }> {
    const r = await this.conversations.ingestInbound({
      tenantId: body.tenantId,
      channel: ConversationChannel.WEB_CHAT,
      threadIdentifier: body.sessionId,
      body: body.body,
      rawPayload: { socketId: client.id },
    });
    return { ok: true, messageId: r.messageId };
  }

  /**
   * Visitor typing indicator. Ephemeral — fanned out by the realtime
   * gateway's domain-event listener.
   */
  @SubscribeMessage('web-chat:typing')
  async handleWebChatTyping(
    @MessageBody() body: { conversationId: string; isTyping: boolean; tenantId: string },
  ): Promise<{ ok: true }> {
    void body;
    return { ok: true };
  }
}
