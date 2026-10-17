import { buildApplianceRow, buildCustomerRow, buildLeadRow, splitTags } from '../import-rows';

const cities = ({ city, cityId }: { city?: string; cityId?: string }) =>
  cityId === 'city_1' || city?.toLowerCase() === 'bengaluru' ? 'city_1' : null;

describe('splitTags', () => {
  it('splits on ; , | and lower-cases', () => {
    expect(splitTags('VIP; society-a,vip|x')).toEqual(['vip', 'society-a', 'x']);
  });
});

describe('buildCustomerRow', () => {
  it('normalises phone, resolves city and extracts custom fields', () => {
    const { value, errors } = buildCustomerRow(
      { fullName: 'Priya', phone: '98765 43210', city: 'Bengaluru', tags: 'a;b', cf_gate: '7' },
      2,
      cities,
    );
    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      phone: '+919876543210',
      cityId: 'city_1',
      tags: ['a', 'b'],
      customFields: { gate: '7' },
    });
  });
  it('reports every invalid field with its row number', () => {
    const { value, errors } = buildCustomerRow({ phone: '123', email: 'bad', city: 'Atlantis' }, 5, cities);
    expect(value).toBeUndefined();
    expect(errors.map((e) => e.field)).toEqual(['fullName', 'phone', 'email', 'city']);
    expect(errors.every((e) => e.row === 5)).toBe(true);
  });
});

describe('buildLeadRow', () => {
  it('defaults source/priority and normalises enums', () => {
    const { value } = buildLeadRow(
      { customerName: 'Rahul', phone: '9876501234', applianceType: 'ac repair', city: 'Pune' },
      2,
      cities,
    );
    expect(value).toMatchObject({
      source: 'MANUAL',
      priority: 'NORMAL',
      applianceType: 'AC_REPAIR',
      cityId: null,
      cityLabel: 'Pune',
    });
  });
  it('rejects invalid enums and pincodes', () => {
    const { errors } = buildLeadRow(
      { customerName: 'R', phone: '9876501234', source: 'TV', pincode: '12' },
      3,
      cities,
    );
    expect(errors.map((e) => e.field)).toEqual(['source', 'pincode']);
  });
});

describe('buildApplianceRow', () => {
  it('parses ISO and DD/MM/YYYY dates', () => {
    const { value, errors } = buildApplianceRow(
      {
        customerPhone: '9876543210',
        category: 'AC_SERVICING',
        brand: 'LG',
        purchaseDate: '01/04/2024',
        installDate: '2024-04-03',
      },
      2,
    );
    expect(errors).toEqual([]);
    expect(value?.purchaseDate?.toISOString()).toBe('2024-04-01T00:00:00.000Z');
    expect(value?.installDate?.toISOString().slice(0, 10)).toBe('2024-04-03');
  });
  it('requires category and brand', () => {
    const { errors } = buildApplianceRow({ customerPhone: '9876543210', category: 'SPACESHIP' }, 4);
    expect(errors.map((e) => e.field)).toEqual(['category', 'brand']);
  });
});
