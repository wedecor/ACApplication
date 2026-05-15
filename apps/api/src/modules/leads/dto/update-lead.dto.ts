import { PartialType, PickType } from '@nestjs/swagger';

import { CreateLeadDto } from './create-lead.dto';

/**
 * Update payload mirrors create, except `source` and `externalRef` are
 * immutable once a lead exists.
 */
export class UpdateLeadDto extends PartialType(
  PickType(CreateLeadDto, [
    'customerName',
    'phone',
    'whatsappNumber',
    'email',
    'applianceType',
    'applianceBrand',
    'issueDescription',
    'addressLine1',
    'addressLine2',
    'landmark',
    'cityId',
    'cityLabel',
    'pincode',
    'geoLatitude',
    'geoLongitude',
    'priority',
    'tags',
  ] as const),
) {}
