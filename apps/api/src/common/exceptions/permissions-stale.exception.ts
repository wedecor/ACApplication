import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@ac/types';

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
