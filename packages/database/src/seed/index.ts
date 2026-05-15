/**
 * Seed script — idempotent. Safe to re-run; uses `upsert` so subsequent runs
 * converge to the same baseline state.
 *
 *   pnpm --filter @ac/database seed
 */
import { assertRegistryValid } from '@ac/auth';
import { PrismaClient, UserRole } from '@prisma/client';

import { syncPermissionsFromSeed } from '../rbac/sync';

const prisma = new PrismaClient();

const NOTIFICATION_TEMPLATES: Array<{
  key: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP' | 'IN_APP';
  subject?: string;
  body: string;
}> = [
  { key: 'auth.otp', channel: 'SMS', body: 'Your AC Platform login code is {{code}}. Valid for 5 minutes.' },
  { key: 'auth.otp', channel: 'WHATSAPP', body: 'Your login code is {{code}}.' },
  {
    key: 'booking.confirmation',
    channel: 'SMS',
    body: 'Booking {{code}} confirmed for {{customerName}} on {{scheduledAt}}.',
  },
  {
    key: 'booking.confirmation',
    channel: 'WHATSAPP',
    body: 'Hi {{customerName}}, your service booking {{code}} is confirmed.',
  },
  { key: 'booking.otp', channel: 'SMS', body: 'OTP for booking {{code}}: share this code with your technician when they arrive.' },
  { key: 'booking.technician_assigned', channel: 'SMS', body: 'Technician {{technician}} assigned to booking {{code}}.' },
  { key: 'booking.technician_reached', channel: 'SMS', body: 'Your technician has arrived for booking {{code}}.' },
  { key: 'booking.completed', channel: 'SMS', body: 'Service for booking {{code}} is complete. Thank you!' },
  { key: 'invoice.generated', channel: 'SMS', body: 'Invoice {{number}} for ₹{{totalMinor}} is ready. Due: ₹{{dueAmountMinor}}.' },
  { key: 'payment.success', channel: 'SMS', body: 'Payment received for invoice {{number}}. Thank you!' },
  { key: 'payment.failed', channel: 'SMS', body: 'Payment failed for invoice {{number}}. Please retry.' },
  { key: 'lead.assigned', channel: 'IN_APP', body: 'Lead {{leadId}} assigned to you.' },
  { key: 'support.ticket.created', channel: 'EMAIL', subject: 'Ticket {{number}} created', body: 'We received your request ({{number}}).' },
  { key: 'support.reply', channel: 'SMS', body: '{{body}}' },
];

async function main() {
  console.info('Seeding AC Platform…');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: { slug: 'default', name: 'AC Platform' },
  });
  console.info(`  ✓ Tenant: ${tenant.name}`);

  assertRegistryValid();
  const rbac = await syncPermissionsFromSeed(prisma, tenant.id, {
    bumpVersionOnChange: false,
    removeOrphanPermissions: false,
  });
  console.info(
    `  ✓ RBAC sync: ${rbac.stats.permissionsUpserted} permissions, ${rbac.stats.rolesSynced} roles (v${rbac.rbacVersion})`,
  );

  // Sample cities
  const cities = [
    { name: 'Bengaluru', state: 'Karnataka', pincodes: ['560001', '560002', '560034'] },
    { name: 'Mumbai', state: 'Maharashtra', pincodes: ['400001', '400050'] },
    { name: 'Delhi', state: 'Delhi', pincodes: ['110001', '110092'] },
  ];
  for (const c of cities) {
    await prisma.city.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: c.name } },
      update: { state: c.state, pincodes: c.pincodes, isActive: true },
      create: {
        tenantId: tenant.id,
        name: c.name,
        state: c.state,
        country: 'IN',
        pincodes: c.pincodes,
        isActive: true,
      },
    });
  }
  console.info(`  ✓ Cities: ${cities.length}`);

  // Default AMC plans — three tiers + one custom template.
  const amcPlans = [
    {
      slug: 'basic',
      name: 'AMC Basic',
      type: 'BASIC' as const,
      description: 'Annual contract covering 2 routine visits and standard support.',
      durationMonths: 12,
      includedVisits: 2,
      emergencySupport: false,
      prioritySupport: false,
      discountBps: 500,
      priceMinor: 199900,
      renewalPriceMinor: 179900,
      visitCadenceDays: 180,
      appliancesCovered: ['AC_SERVICING'] as const,
      features: [
        '2 routine maintenance visits',
        '5% discount on add-on repairs',
        'Standard support hours',
      ],
    },
    {
      slug: 'standard',
      name: 'AMC Standard',
      type: 'STANDARD' as const,
      description: '4 visits, priority scheduling, emergency support on weekdays.',
      durationMonths: 12,
      includedVisits: 4,
      emergencySupport: true,
      prioritySupport: true,
      discountBps: 1000,
      priceMinor: 349900,
      renewalPriceMinor: 299900,
      visitCadenceDays: 90,
      appliancesCovered: ['AC_SERVICING', 'WASHING_MACHINE'] as const,
      features: [
        '4 maintenance visits per year',
        '10% discount on add-on repairs',
        'Priority scheduling',
        'Weekday emergency support',
      ],
    },
    {
      slug: 'premium',
      name: 'AMC Premium',
      type: 'PREMIUM' as const,
      description: 'Unlimited support, 6 routine visits, 24×7 emergency response.',
      durationMonths: 12,
      includedVisits: 6,
      emergencySupport: true,
      prioritySupport: true,
      discountBps: 1500,
      priceMinor: 599900,
      renewalPriceMinor: 499900,
      visitCadenceDays: 60,
      appliancesCovered: [
        'AC_SERVICING',
        'WASHING_MACHINE',
        'REFRIGERATOR',
        'MICROWAVE',
      ] as const,
      features: [
        '6 maintenance visits per year',
        '15% discount on add-on repairs',
        'Priority dispatch + 24×7 emergency support',
        'Free spare parts up to ₹500 / visit',
      ],
    },
  ];
  for (const plan of amcPlans) {
    await prisma.aMCPlan.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: plan.slug } },
      update: {
        name: plan.name,
        type: plan.type,
        description: plan.description,
        durationMonths: plan.durationMonths,
        includedVisits: plan.includedVisits,
        emergencySupport: plan.emergencySupport,
        prioritySupport: plan.prioritySupport,
        discountBps: plan.discountBps,
        priceMinor: plan.priceMinor,
        renewalPriceMinor: plan.renewalPriceMinor,
        visitCadenceDays: plan.visitCadenceDays,
        appliancesCovered: [...plan.appliancesCovered],
        features: plan.features as unknown as object,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        slug: plan.slug,
        name: plan.name,
        type: plan.type,
        description: plan.description,
        durationMonths: plan.durationMonths,
        includedVisits: plan.includedVisits,
        emergencySupport: plan.emergencySupport,
        prioritySupport: plan.prioritySupport,
        discountBps: plan.discountBps,
        priceMinor: plan.priceMinor,
        renewalPriceMinor: plan.renewalPriceMinor,
        visitCadenceDays: plan.visitCadenceDays,
        appliancesCovered: [...plan.appliancesCovered],
        features: plan.features as unknown as object,
        isActive: true,
      },
    });
  }
  console.info(`  ✓ AMC plans: ${amcPlans.length}`);

  // Staff users for admin CRM login (OTP: see API logs in development).
  const staffUsers: Array<{
    phone: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }> = [
    { phone: '+919876543210', firstName: 'Ops', lastName: 'Dispatcher', role: 'DISPATCHER' },
    { phone: '+919999999999', firstName: 'Platform', lastName: 'Admin', role: 'ADMIN' },
  ];

  for (const spec of staffUsers) {
    const user = await prisma.user.upsert({
      where: { phone: spec.phone },
      update: {
        tenantId: tenant.id,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phoneVerified: true,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        tenantId: tenant.id,
        phone: spec.phone,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phoneVerified: true,
        status: 'ACTIVE',
      },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: { tenantId_key: { tenantId: tenant.id, key: spec.role } },
    });

    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    console.info(`  ✓ Staff user: ${spec.firstName} ${spec.lastName} (${spec.phone}, ${spec.role})`);
  }

  for (const tpl of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: {
        key_channel_locale: {
          key: tpl.key,
          channel: tpl.channel,
          locale: 'en-IN',
        },
      },
      update: { subject: tpl.subject, body: tpl.body, isActive: true },
      create: {
        key: tpl.key,
        channel: tpl.channel,
        subject: tpl.subject,
        body: tpl.body,
        locale: 'en-IN',
      },
    });
  }
  console.info(`  ✓ Notification templates: ${NOTIFICATION_TEMPLATES.length}`);

  console.info('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
