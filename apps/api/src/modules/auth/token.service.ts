import { Inject, Injectable } from '@nestjs/common';
import { TokenService as CoreTokenService } from '@ac/auth';
import type { LoadedServerEnv } from '@ac/config';

import { APP_CONFIG } from '../../common/config/config.module';

/**
 * Nest-flavored wrapper around the core `@ac/auth` token service. We inject
 * the validated env so the underlying class stays framework-agnostic.
 */
@Injectable()
export class TokenService extends CoreTokenService {
  constructor(@Inject(APP_CONFIG) env: LoadedServerEnv) {
    super({
      accessSecret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  }
}
