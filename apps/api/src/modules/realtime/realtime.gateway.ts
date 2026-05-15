import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  type AmcSubscriptionActivatedEvent,
  type AmcSubscriptionRenewedEvent,
  type AnyDomainEvent,
  type BookingAssignedEvent,
  type BookingCreatedEvent,
  type BookingStatusChangedEvent,
  type CallAnsweredEvent,
  type CallCompletedEvent,
  type CallDispositionSetEvent,
  type CallIncomingEvent,
  type CallMissedEvent,
  type CallRecordingReadyEvent,
  type ConversationAssignedEvent,
  type ConversationCreatedEvent,
  type ConversationMessageReceivedEvent,
  type ConversationMessageSentEvent,
  type ConversationMessageStatusUpdatedEvent,
  type ConversationReadReceiptEvent,
  type ConversationStatusChangedEvent,
  type ConversationTypingEvent,
  type DispatchAlertRaisedEvent,
  type DispatchAutoAssignedEvent,
  type DispatchManualAssignedEvent,
  type DispatchReassignedEvent,
  DomainEventName,
  type InventoryAlertRaisedEvent,
  type InventoryAlertResolvedEvent,
  type InventoryStockUpdatedEvent,
  type InvoicePaidEvent,
  type InvoiceSentEvent,
  type LeadAssignedEvent,
  type LeadCreatedEvent,
  type LeadStatusChangedEvent,
  type PaymentRefundedEvent,
  type PaymentSucceededEvent,
  type PayoutApprovedEvent,
  type PayoutPaidEvent,
  type PurchaseOrderApprovedEvent,
  type PurchaseOrderCreatedEvent,
  type PurchaseOrderReceivedEvent,
  type StockTransferApprovedEvent,
  type StockTransferDispatchedEvent,
  type StockTransferReceivedEvent,
  type StockTransferRequestedEvent,
  type TechnicianArrivedEvent,
  type TechnicianDelayedEvent,
  type TechnicianLocationUpdatedEvent,
  type TechnicianOfflineEvent,
  type TechnicianOnlineEvent,
  type TechnicianStatusChangedEvent,
  type TicketAssignedEvent,
  type TicketCreatedEvent,
  type TicketEscalatedEvent,
  type TicketReplySentEvent,
  type TicketResolvedEvent,
  type TicketSlaBreachWarningEvent,
  type TicketSlaBreachedEvent,
  type TicketStatusChangedEvent,
  Permission,
} from '@ac/types';
import { hasPermission } from '@ac/auth';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from '../auth/token.service';

const ROOM_PREFIX_PERMISSIONS: Array<{ prefix: string; permission: Permission }> = [
  { prefix: 'dispatch:', permission: Permission.DISPATCH_VIEW },
  { prefix: 'technician:', permission: Permission.TECHNICIAN_TRACK },
  { prefix: 'finance:', permission: Permission.FINANCE_VIEW },
  { prefix: 'lead:', permission: Permission.LEAD_VIEW },
  { prefix: 'booking:', permission: Permission.BOOKING_READ },
];

/**
 * Realtime gateway — translates domain events into per-room websocket
 * broadcasts and exposes a `subscribe` op for clients.
 *
 * Rooms:
 *   tenant:{tenantId}                  — broadcast within a tenant
 *   user:{userId}                      — personal channel
 *   dispatch:global                    — every dispatch dashboard
 *   dispatch:city:{cityId}             — city-scoped ops feed
 *   technician:{technicianId}          — field-app channel
 *   lead:{leadId}                      — per-lead detail page
 *   booking:{bookingId}                — per-job tracking
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  path: '/ws',
  transports: ['websocket'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    // JWT validation — disconnect anonymous sockets.
    const token =
      (client.handshake.auth?.['token'] as string | undefined) ??
      this.extractBearer(client.handshake.headers.authorization);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.tokens.verifyAccess(token);
      const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
        where: { id: payload.tid },
        select: { rbacVersion: true },
      });
      if ((payload.pv ?? 0) < tenant.rbacVersion) {
        client.disconnect(true);
        return;
      }
      client.data['userId'] = payload.sub;
      client.data['tenantId'] = payload.tid;
      client.data['permissions'] = payload.permissions ?? [];
      // Auto-join personal + tenant rooms.
      await client.join(`user:${payload.sub}`);
      await client.join(`tenant:${payload.tid}`);
      this.logger.debug(`WS connected user=${payload.sub}`);
    } catch (err) {
      this.logger.debug({ err }, 'WS auth failed');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { rooms: string[] },
  ): Promise<{ ok: true; rooms: string[] }> {
    const allowed = (body.rooms ?? []).filter((r) => this.canJoin(client, r));
    await Promise.all(allowed.map((r) => client.join(r)));
    return { ok: true, rooms: allowed };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { rooms: string[] },
  ): Promise<{ ok: true }> {
    await Promise.all((body.rooms ?? []).map((r) => client.leave(r)));
    return { ok: true };
  }

  // --------------- domain event → room broadcast ---------------

  @OnEvent(DomainEventName.LeadCreated)
  onLeadCreated(event: LeadCreatedEvent): void {
    this.broadcast([`tenant:${event.actorId ? 'all' : 'all'}`], event);
  }

  @OnEvent(DomainEventName.LeadAssigned)
  onLeadAssigned(event: LeadAssignedEvent): void {
    this.broadcast(
      [`lead:${event.payload.leadId}`, `user:${event.payload.assignedUserId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.LeadStatusChanged)
  onLeadStatusChanged(event: LeadStatusChangedEvent): void {
    this.broadcast([`lead:${event.payload.leadId}`], event);
  }

  @OnEvent(DomainEventName.BookingCreated)
  onBookingCreated(event: BookingCreatedEvent): void {
    this.broadcast([`booking:${event.payload.bookingId}`], event);
  }

  @OnEvent(DomainEventName.BookingAssigned)
  onBookingAssigned(event: BookingAssignedEvent): void {
    this.broadcast(
      [
        `booking:${event.payload.bookingId}`,
        `technician:${event.payload.technicianId}`,
      ],
      event,
    );
  }

  @OnEvent(DomainEventName.BookingStatusChanged)
  onBookingStatusChanged(event: BookingStatusChangedEvent): void {
    this.broadcast([`booking:${event.payload.bookingId}`, 'dispatch:global'], event);
  }

  // ---- Live tracking & dispatch events ----

  @OnEvent(DomainEventName.TechnicianLocationUpdated)
  onLocationUpdated(event: TechnicianLocationUpdatedEvent): void {
    // Hot path — fans out to the dispatcher live-map + the booking room
    // assigned to this tech. Throttling happens client-side (RAF coalesce).
    this.broadcast(
      ['dispatch:global', `technician:${event.payload.technicianId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TechnicianStatusChanged)
  onTechStatusChanged(event: TechnicianStatusChangedEvent): void {
    this.broadcast(
      ['dispatch:global', `technician:${event.payload.technicianId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TechnicianOnline)
  onTechOnline(event: TechnicianOnlineEvent): void {
    this.broadcast(
      ['dispatch:global', `dispatch:city:${event.payload.cityId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TechnicianOffline)
  onTechOffline(event: TechnicianOfflineEvent): void {
    this.broadcast(
      ['dispatch:global', `dispatch:city:${event.payload.cityId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TechnicianArrived)
  onTechArrived(event: TechnicianArrivedEvent): void {
    this.broadcast(
      [`booking:${event.payload.bookingId}`, `technician:${event.payload.technicianId}`, 'dispatch:global'],
      event,
    );
  }

  @OnEvent(DomainEventName.TechnicianDelayed)
  onTechDelayed(event: TechnicianDelayedEvent): void {
    this.broadcast(
      [`booking:${event.payload.bookingId}`, 'dispatch:global'],
      event,
    );
  }

  @OnEvent(DomainEventName.DispatchAutoAssigned)
  onDispatchAuto(event: DispatchAutoAssignedEvent): void {
    this.broadcast(
      ['dispatch:global', `booking:${event.payload.bookingId}`, `technician:${event.payload.technicianId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.DispatchManualAssigned)
  onDispatchManual(event: DispatchManualAssignedEvent): void {
    this.broadcast(
      ['dispatch:global', `booking:${event.payload.bookingId}`, `technician:${event.payload.technicianId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.DispatchReassigned)
  onDispatchReassigned(event: DispatchReassignedEvent): void {
    const rooms = ['dispatch:global', `booking:${event.payload.bookingId}`, `technician:${event.payload.toTechnicianId}`];
    if (event.payload.fromTechnicianId) rooms.push(`technician:${event.payload.fromTechnicianId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.DispatchAlertRaised)
  onDispatchAlert(event: DispatchAlertRaisedEvent): void {
    const rooms = ['dispatch:global'];
    if (event.payload.cityId) rooms.push(`dispatch:city:${event.payload.cityId}`);
    this.broadcast(rooms, event);
  }

  // ---------------- FINANCE BROADCASTS ----------------

  @OnEvent(DomainEventName.InvoiceSent)
  onInvoiceSent(event: InvoiceSentEvent): void {
    this.broadcast(
      [`user:${event.payload.customerId}`, `invoice:${event.payload.invoiceId}`, 'finance:global'],
      event,
    );
  }

  @OnEvent(DomainEventName.InvoicePaid)
  onInvoicePaid(event: InvoicePaidEvent): void {
    this.broadcast(
      [`user:${event.payload.customerId}`, `invoice:${event.payload.invoiceId}`, 'finance:global'],
      event,
    );
  }

  @OnEvent(DomainEventName.PaymentSucceeded)
  onPaymentSucceeded(event: PaymentSucceededEvent): void {
    this.broadcast([`user:${event.payload.customerId}`, 'finance:global'], event);
  }

  @OnEvent(DomainEventName.PaymentRefunded)
  onPaymentRefunded(event: PaymentRefundedEvent): void {
    this.broadcast([`user:${event.payload.customerId}`, 'finance:global'], event);
  }

  @OnEvent(DomainEventName.AmcSubscriptionActivated)
  onAmcActivated(event: AmcSubscriptionActivatedEvent): void {
    this.broadcast(
      [`user:${event.payload.customerId}`, `amc:${event.payload.subscriptionId}`, 'finance:global'],
      event,
    );
  }

  @OnEvent(DomainEventName.AmcSubscriptionRenewed)
  onAmcRenewed(event: AmcSubscriptionRenewedEvent): void {
    this.broadcast([`amc:${event.payload.subscriptionId}`, 'finance:global'], event);
  }

  @OnEvent(DomainEventName.PayoutApproved)
  onPayoutApproved(event: PayoutApprovedEvent): void {
    this.broadcast(['finance:global', 'finance:payouts'], event);
  }

  @OnEvent(DomainEventName.PayoutPaid)
  onPayoutPaid(event: PayoutPaidEvent): void {
    this.broadcast(['finance:global', 'finance:payouts'], event);
  }

  // ---------------- INVENTORY BROADCASTS ----------------

  @OnEvent(DomainEventName.InventoryStockUpdated)
  onInventoryStockUpdated(event: InventoryStockUpdatedEvent): void {
    this.broadcast(
      [
        'inventory:global',
        `inventory:warehouse:${event.payload.warehouseId}`,
        `inventory:item:${event.payload.itemId}`,
      ],
      event,
    );
  }

  @OnEvent(DomainEventName.InventoryAlertRaised)
  onInventoryAlertRaised(event: InventoryAlertRaisedEvent): void {
    const rooms = ['inventory:global', 'inventory:alerts'];
    if (event.payload.warehouseId) rooms.push(`inventory:warehouse:${event.payload.warehouseId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.InventoryAlertResolved)
  onInventoryAlertResolved(event: InventoryAlertResolvedEvent): void {
    this.broadcast(['inventory:global', 'inventory:alerts'], event);
  }

  @OnEvent(DomainEventName.PurchaseOrderCreated)
  onPoCreated(event: PurchaseOrderCreatedEvent): void {
    this.broadcast(['inventory:global', 'inventory:procurement'], event);
  }

  @OnEvent(DomainEventName.PurchaseOrderApproved)
  onPoApproved(event: PurchaseOrderApprovedEvent): void {
    this.broadcast(['inventory:global', 'inventory:procurement'], event);
  }

  @OnEvent(DomainEventName.PurchaseOrderReceived)
  onPoReceived(event: PurchaseOrderReceivedEvent): void {
    this.broadcast(['inventory:global', 'inventory:procurement'], event);
  }

  @OnEvent(DomainEventName.StockTransferRequested)
  onTransferRequested(event: StockTransferRequestedEvent): void {
    this.broadcast(
      [
        'inventory:global',
        'inventory:transfers',
        `inventory:warehouse:${event.payload.sourceWarehouseId}`,
        `inventory:warehouse:${event.payload.destWarehouseId}`,
      ],
      event,
    );
  }

  @OnEvent(DomainEventName.StockTransferApproved)
  onTransferApproved(event: StockTransferApprovedEvent): void {
    this.broadcast(['inventory:global', 'inventory:transfers'], event);
  }

  @OnEvent(DomainEventName.StockTransferDispatched)
  onTransferDispatched(event: StockTransferDispatchedEvent): void {
    this.broadcast(['inventory:global', 'inventory:transfers'], event);
  }

  @OnEvent(DomainEventName.StockTransferReceived)
  onTransferReceived(event: StockTransferReceivedEvent): void {
    this.broadcast(['inventory:global', 'inventory:transfers'], event);
  }

  // ----------------------------- support tickets -----------------------------

  @OnEvent(DomainEventName.TicketCreated)
  onTicketCreated(event: TicketCreatedEvent): void {
    const rooms = ['support:global', `support:queue:${event.payload.source}`];
    if (event.payload.assignedAgentId) rooms.push(`user:${event.payload.assignedAgentId}`);
    if (event.payload.customerId) rooms.push(`user:${event.payload.customerId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.TicketAssigned)
  onTicketAssigned(event: TicketAssignedEvent): void {
    this.broadcast(
      [
        'support:global',
        `ticket:${event.payload.ticketId}`,
        `user:${event.payload.assignedAgentId}`,
        ...(event.payload.previousAgentId ? [`user:${event.payload.previousAgentId}`] : []),
      ],
      event,
    );
  }

  @OnEvent(DomainEventName.TicketStatusChanged)
  onTicketStatusChanged(event: TicketStatusChangedEvent): void {
    this.broadcast(['support:global', `ticket:${event.payload.ticketId}`], event);
  }

  @OnEvent(DomainEventName.TicketEscalated)
  onTicketEscalated(event: TicketEscalatedEvent): void {
    this.broadcast(
      ['support:global', 'support:escalations', `ticket:${event.payload.ticketId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TicketResolved)
  onTicketResolved(event: TicketResolvedEvent): void {
    this.broadcast(['support:global', `ticket:${event.payload.ticketId}`], event);
  }

  @OnEvent(DomainEventName.TicketReplySent)
  onTicketReplySent(event: TicketReplySentEvent): void {
    this.broadcast(
      ['support:inbox', `ticket:${event.payload.ticketId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TicketSlaBreachWarning)
  onSlaWarning(event: TicketSlaBreachWarningEvent): void {
    this.broadcast(
      ['support:sla', 'support:global', `ticket:${event.payload.ticketId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.TicketSlaBreached)
  onSlaBreached(event: TicketSlaBreachedEvent): void {
    this.broadcast(
      ['support:sla', 'support:global', `ticket:${event.payload.ticketId}`],
      event,
    );
  }

  // --------------------------- conversations / chat ---------------------------

  @OnEvent(DomainEventName.ConversationCreated)
  onConversationCreated(event: ConversationCreatedEvent): void {
    const rooms = ['support:inbox', `conversation:${event.payload.conversationId}`];
    if (event.payload.ticketId) rooms.push(`ticket:${event.payload.ticketId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.ConversationAssigned)
  onConversationAssigned(event: ConversationAssignedEvent): void {
    this.broadcast(
      [
        'support:inbox',
        `conversation:${event.payload.conversationId}`,
        `user:${event.payload.assignedAgentId}`,
      ],
      event,
    );
  }

  @OnEvent(DomainEventName.ConversationStatusChanged)
  onConversationStatusChanged(event: ConversationStatusChangedEvent): void {
    this.broadcast(
      ['support:inbox', `conversation:${event.payload.conversationId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.ConversationMessageReceived)
  onMessageReceived(event: ConversationMessageReceivedEvent): void {
    const rooms = [
      'support:inbox',
      `conversation:${event.payload.conversationId}`,
    ];
    if (event.payload.ticketId) rooms.push(`ticket:${event.payload.ticketId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.ConversationMessageSent)
  onMessageSent(event: ConversationMessageSentEvent): void {
    const rooms = [`conversation:${event.payload.conversationId}`];
    if (event.payload.ticketId) rooms.push(`ticket:${event.payload.ticketId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.ConversationMessageStatusUpdated)
  onMessageStatusUpdated(event: ConversationMessageStatusUpdatedEvent): void {
    this.broadcast([`conversation:${event.payload.conversationId}`], event);
  }

  @OnEvent(DomainEventName.ConversationTyping)
  onTyping(event: ConversationTypingEvent): void {
    this.broadcast([`conversation:${event.payload.conversationId}`], event);
  }

  @OnEvent(DomainEventName.ConversationReadReceipt)
  onReadReceipt(event: ConversationReadReceiptEvent): void {
    this.broadcast([`conversation:${event.payload.conversationId}`], event);
  }

  // ---------------------------------- calls ----------------------------------

  @OnEvent(DomainEventName.CallIncoming)
  onCallIncoming(event: CallIncomingEvent): void {
    const rooms = ['support:calls', 'support:global'];
    if (event.payload.queue) rooms.push(`support:queue:${event.payload.queue}`);
    if (event.payload.customerId) rooms.push(`user:${event.payload.customerId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.CallAnswered)
  onCallAnswered(event: CallAnsweredEvent): void {
    this.broadcast(
      ['support:calls', `call:${event.payload.callLogId}`, `user:${event.payload.agentUserId}`],
      event,
    );
  }

  @OnEvent(DomainEventName.CallCompleted)
  onCallCompleted(event: CallCompletedEvent): void {
    const rooms = ['support:calls', `call:${event.payload.callLogId}`];
    if (event.payload.agentUserId) rooms.push(`user:${event.payload.agentUserId}`);
    this.broadcast(rooms, event);
  }

  @OnEvent(DomainEventName.CallMissed)
  onCallMissed(event: CallMissedEvent): void {
    this.broadcast(['support:calls', 'support:missed'], event);
  }

  @OnEvent(DomainEventName.CallDispositionSet)
  onCallDisposition(event: CallDispositionSetEvent): void {
    this.broadcast([`call:${event.payload.callLogId}`], event);
  }

  @OnEvent(DomainEventName.CallRecordingReady)
  onCallRecording(event: CallRecordingReadyEvent): void {
    this.broadcast([`call:${event.payload.callLogId}`], event);
  }

  // Wildcard: forward every other event to the originating tenant room.
  @OnEvent('*.*')
  onAnyEvent(event: AnyDomainEvent): void {
    const handled = new Set<string>([
      DomainEventName.LeadCreated,
      DomainEventName.LeadAssigned,
      DomainEventName.LeadStatusChanged,
      DomainEventName.BookingCreated,
      DomainEventName.BookingAssigned,
      DomainEventName.BookingStatusChanged,
      DomainEventName.TechnicianLocationUpdated,
      DomainEventName.TechnicianStatusChanged,
      DomainEventName.TechnicianOnline,
      DomainEventName.TechnicianOffline,
      DomainEventName.TechnicianArrived,
      DomainEventName.TechnicianDelayed,
      DomainEventName.DispatchAutoAssigned,
      DomainEventName.DispatchManualAssigned,
      DomainEventName.DispatchReassigned,
      DomainEventName.DispatchAlertRaised,
      DomainEventName.InvoiceSent,
      DomainEventName.InvoicePaid,
      DomainEventName.PaymentSucceeded,
      DomainEventName.PaymentRefunded,
      DomainEventName.AmcSubscriptionActivated,
      DomainEventName.AmcSubscriptionRenewed,
      DomainEventName.PayoutApproved,
      DomainEventName.PayoutPaid,
      DomainEventName.InventoryStockUpdated,
      DomainEventName.InventoryAlertRaised,
      DomainEventName.InventoryAlertResolved,
      DomainEventName.PurchaseOrderCreated,
      DomainEventName.PurchaseOrderApproved,
      DomainEventName.PurchaseOrderReceived,
      DomainEventName.StockTransferRequested,
      DomainEventName.StockTransferApproved,
      DomainEventName.StockTransferDispatched,
      DomainEventName.StockTransferReceived,
      DomainEventName.TicketCreated,
      DomainEventName.TicketAssigned,
      DomainEventName.TicketStatusChanged,
      DomainEventName.TicketEscalated,
      DomainEventName.TicketResolved,
      DomainEventName.TicketReplySent,
      DomainEventName.TicketSlaBreachWarning,
      DomainEventName.TicketSlaBreached,
      DomainEventName.ConversationCreated,
      DomainEventName.ConversationAssigned,
      DomainEventName.ConversationStatusChanged,
      DomainEventName.ConversationMessageReceived,
      DomainEventName.ConversationMessageSent,
      DomainEventName.ConversationMessageStatusUpdated,
      DomainEventName.ConversationTyping,
      DomainEventName.ConversationReadReceipt,
      DomainEventName.CallIncoming,
      DomainEventName.CallAnswered,
      DomainEventName.CallCompleted,
      DomainEventName.CallMissed,
      DomainEventName.CallDispositionSet,
      DomainEventName.CallRecordingReady,
    ]);
    if (handled.has(event.name)) return;
    this.server.emit(event.name, event);
  }

  /** Type-safe publish helper for services that bypass the event bus. */
  emitToRoom(room: string, eventName: string, payload: unknown): void {
    this.server.to(room).emit(eventName, payload);
  }

  // --------------- helpers ---------------

  private broadcast(rooms: string[], event: AnyDomainEvent): void {
    this.server.to(rooms).emit(event.name, event);
  }

  private canJoin(client: Socket, room: string): boolean {
    const userId = client.data['userId'] as string | undefined;
    const tenantId = client.data['tenantId'] as string | undefined;
    if (!userId || !tenantId) return false;

    if (room.startsWith('user:')) return room === `user:${userId}`;
    if (room.startsWith('tenant:')) return room === `tenant:${tenantId}`;

    if (room.startsWith('ticket:') || room.startsWith('support:')) {
      return this.clientHasPermission(client, Permission.TICKET_VIEW);
    }
    if (room.startsWith('conversation:')) {
      return this.clientHasPermission(client, Permission.CONVERSATION_VIEW);
    }
    if (room.startsWith('call:')) {
      return this.clientHasPermission(client, Permission.CALL_VIEW);
    }

    for (const rule of ROOM_PREFIX_PERMISSIONS) {
      if (room.startsWith(rule.prefix)) {
        return this.clientHasPermission(client, rule.permission);
      }
    }

    return false;
  }

  private clientHasPermission(client: Socket, required: Permission): boolean {
    const permissions = client.data['permissions'] as Permission[] | undefined;
    return hasPermission(required, { permissions: permissions ?? [], roles: [] });
  }

  private extractBearer(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.startsWith('Bearer ')) return null;
    return value.slice('Bearer '.length);
  }
}
