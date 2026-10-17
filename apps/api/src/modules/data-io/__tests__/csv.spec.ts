import { CsvParseError, escapeCsvCell, parseCsv, rowsToRecords, toCsvRow } from '../csv';

describe('escapeCsvCell', () => {
  it('quotes delimiters, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralises formula injection', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvCell('+cmd')).toBe("'+cmd");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
  });
  it('keeps signed numbers and E.164 phones intact', () => {
    expect(escapeCsvCell(-12.5)).toBe('-12.5');
    expect(escapeCsvCell('+919876543210')).toBe('+919876543210');
  });
  it('serialises null, dates and objects', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(new Date('2025-01-02T00:00:00.000Z'))).toBe('2025-01-02T00:00:00.000Z');
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it('builds CRLF-terminated rows', () => {
    expect(toCsvRow(['a', 1, null])).toBe('a,1,\r\n');
  });
});

describe('parseCsv', () => {
  it('round-trips escaped cells', () => {
    const csv = toCsvRow(['name', 'note']) + toCsvRow(['A, B', 'x "y"\nz']);
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ['A, B', 'x "y"\nz'],
    ]);
  });
  it('handles BOM, LF endings, blank lines and missing trailing newline', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n3,')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ]);
  });
  it('throws on unterminated quotes', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(CsvParseError);
  });
});

describe('rowsToRecords', () => {
  it('maps header aliases and keeps cf_ columns', () => {
    const { headers, records } = rowsToRecords(
      [
        ['Full Name', 'Mobile', 'CF_gate_code', 'unknown'],
        ['Priya', '9876543210', '42', ''],
      ],
      { fullName: ['name', 'full name'], phone: ['mobile'] },
    );
    expect(headers).toEqual(['fullName', 'phone', 'cf_gate_code', 'unknown']);
    expect(records).toEqual([{ fullName: 'Priya', phone: '9876543210', cf_gate_code: '42' }]);
  });
});
