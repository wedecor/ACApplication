/**
 * Tiny shared style sheet for finance PDFs.
 *
 * Keeping these constants central makes it trivial to rebrand later
 * (white-labelling per tenant lives on top of this module) and ensures
 * invoices / quotations / receipts feel visually consistent.
 */

export const PDF_BRAND = {
  name: process.env.BRAND_NAME ?? 'AC Platform Pvt Ltd',
  legalName: process.env.BRAND_LEGAL_NAME ?? 'AC Platform Pvt Ltd',
  addressLines: (
    process.env.BRAND_ADDRESS ??
    '4th Floor, Sigma Tower\nKoramangala, Bengaluru 560034\nKarnataka, India'
  ).split('\n'),
  email: process.env.BRAND_EMAIL ?? 'support@acplatform.io',
  phone: process.env.BRAND_PHONE ?? '+91 99999 99999',
  website: process.env.BRAND_WEBSITE ?? 'https://acplatform.io',
  gstin: process.env.BRAND_GSTIN ?? '29ABCDE1234F1Z5',
  pan: process.env.BRAND_PAN ?? 'ABCDE1234F',
  primaryColor: '#0EA5E9',
  accentColor: '#0F172A',
  mutedColor: '#64748B',
  borderColor: '#E2E8F0',
};

export const PDF_FONTS = {
  base: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
};

export type PdfBrand = typeof PDF_BRAND;
