import { BadRequestException } from '@nestjs/common';

import { DataImportService } from '../data-import.service';

function build() {
  const prisma = {
    client: {
      city: { findMany: jest.fn().mockResolvedValue([{ id: 'city_1', name: 'Bengaluru' }]) },
      customer: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c_old', phone: '+919999999999' }]),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      lead: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      customerAppliance: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    },
  };
  const customers = { createForTenant: jest.fn().mockResolvedValue({ id: 'c_new' }) };
  const leads = { nextCode: jest.fn().mockResolvedValue('LD-2026-000001') };
  const customFields = { definitionsFor: jest.fn().mockResolvedValue([]) };
  const service = new DataImportService(
    prisma as never,
    customers as never,
    leads as never,
    customFields as never,
  );
  return { service, prisma, customers, leads };
}

const CSV = [
  'Name,Mobile,Email,City',
  'Priya,98765 43210,p@x.com,Bengaluru',
  'Dup In File,+919876543210,,',
  'Existing,9999999999,,',
  'Bad,123,,',
].join('\n');

describe('DataImportService', () => {
  it('dry run reports errors and duplicates without writing', async () => {
    const { service, customers } = build();
    const report = await service.run('t1', 'u1', 'customers', CSV, true);
    expect(report).toMatchObject({ total: 4, valid: 1, created: 0, skipped: 3 });
    expect(report.errors).toEqual([expect.objectContaining({ row: 5, field: 'phone' })]);
    expect(report.duplicates.map((d) => [d.row, d.existingId])).toEqual([
      [3, null],
      [4, 'c_old'],
    ]);
    expect(customers.createForTenant).not.toHaveBeenCalled();
  });

  it('creates valid rows when not a dry run', async () => {
    const { service, customers } = build();
    const report = await service.run('t1', 'u1', 'customers', CSV, false);
    expect(report.created).toBe(1);
    expect(customers.createForTenant).toHaveBeenCalledWith(
      't1',
      'u1',
      expect.objectContaining({ phone: '+919876543210', cityId: 'city_1', email: 'p@x.com' }),
    );
  });

  it('reports per-row failures from the writer', async () => {
    const { service, customers } = build();
    customers.createForTenant.mockRejectedValue(new BadRequestException('Account not found'));
    const report = await service.run('t1', 'u1', 'customers', CSV, false);
    expect(report.created).toBe(0);
    expect(report.errors).toContainEqual({ row: 2, message: 'Account not found' });
  });

  it('requires an existing customer for appliances', async () => {
    const { service, prisma } = build();
    const csv = 'customerPhone,category,brand,serialNumber\n9999999999,AC_SERVICING,LG,S1\n9000000000,AC_SERVICING,LG,S2\n9999999999,AC_SERVICING,LG,s1';
    const report = await service.run('t1', 'u1', 'appliances', csv, false);
    expect(report.created).toBe(1);
    expect(report.errors).toEqual([expect.objectContaining({ row: 3, field: 'customerPhone' })]);
    expect(report.duplicates).toEqual([expect.objectContaining({ row: 4 })]);
    expect(prisma.client.customerAppliance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: 'c_old', serialNumber: 'S1', category: 'AC_SERVICING' }),
    });
  });

  it('rejects unknown entities and oversized files', async () => {
    const { service } = build();
    await expect(service.run('t1', 'u1', 'bookings', 'a\n1', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const big = ['name,phone', ...Array.from({ length: 5001 }, () => 'a,9876543210')].join('\n');
    await expect(service.run('t1', 'u1', 'customers', big, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('serves a template with header + example row', () => {
    const { service } = build();
    const lines = service.template('leads').trim().split('\r\n');
    expect(lines[0]).toContain('customerName,phone');
    expect(lines).toHaveLength(2);
  });
});
