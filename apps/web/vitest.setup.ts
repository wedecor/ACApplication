import '@testing-library/jest-dom/vitest';

// Provide sensible defaults so `@/env` resolves without throwing during
// unit tests. Real values come from `.env.*` at runtime.
process.env.NEXT_PUBLIC_API_URL ||= 'http://localhost:4000';
process.env.NEXT_PUBLIC_WEB_URL ||= 'http://localhost:3000';
process.env.NEXT_PUBLIC_ADMIN_URL ||= 'http://localhost:3001';
process.env.NEXT_PUBLIC_APP_NAME ||= 'AC Platform';
process.env.NEXT_PUBLIC_APP_ENV ||= 'test';
process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||= '+919999999999';
process.env.NEXT_PUBLIC_SUPPORT_PHONE ||= '+919999999999';
process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||= 'hello@example.com';
