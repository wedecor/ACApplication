import { ApiErrorCode } from '@ac/types';
import { HttpException, HttpStatus } from '@nestjs/common';

/** Raised when JWT permission version does not match tenant RBAC revision. */
export class PermissionsStaleException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        code: ApiErrorCode.PERMISSIONS_STALE,
        message: 'Permissions updated. Refresh your session.',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
