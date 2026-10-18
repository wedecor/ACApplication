import { NotFoundException } from '@nestjs/common';

import { assertPublicSessionId } from '../public-chat.controller';

describe('assertPublicSessionId', () => {
  it('accepts the ids issued by /start', () => {
    expect(() => assertPublicSessionId('web-chat:3f2a1c9e-8b7d-4e6f-9a1b-2c3d4e5f6a7b')).not.toThrow();
  });

  it('rejects phone-keyed or arbitrary thread ids', () => {
    for (const id of ['+919876543210', 'web-chat:+919876543210', 'web_chat:abc', '']) {
      expect(() => assertPublicSessionId(id)).toThrow(NotFoundException);
    }
  });
});
