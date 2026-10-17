import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// --------------------------------------------------------------- addresses

export class CreateMyAddressDto {
  @ApiProperty({ enum: ['HOME', 'WORK', 'OTHER'] })
  @IsIn(['HOME', 'WORK', 'OTHER'])
  label!: 'HOME' | 'WORK' | 'OTHER';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({ description: 'Defaults to the state of the matching serviceable city.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @ApiProperty()
  @Matches(/^\d{4,8}$/)
  pincode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  setDefault?: boolean;
}

export class UpdateMyAddressDto extends PartialType(CreateMyAddressDto) {
  /** The app's `Partial<CustomerAddress>` may echo these back — accepted and ignored / mapped. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// -------------------------------------------------------------- appliances

export const APPLIANCE_CATEGORIES = [
  'AC_REPAIR',
  'AC_INSTALLATION',
  'AC_SERVICING',
  'REFRIGERATOR',
  'WASHING_MACHINE',
  'MICROWAVE',
  'GEYSER',
  'CHIMNEY',
  'TELEVISION',
  'WATER_PURIFIER',
  'DISHWASHER',
  'AIR_COOLER',
  'INVERTER_UPS',
  'CEILING_FAN',
  'OVEN',
  'VACUUM_CLEANER',
  'ELECTRICAL_WIRING',
  'OTHER',
] as const;

export class CreateMyApplianceDto {
  @ApiProperty({ enum: APPLIANCE_CATEGORIES })
  @IsIn(APPLIANCE_CATEGORIES)
  category!: (typeof APPLIANCE_CATEGORIES)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  modelNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNumber?: string | null;

  @ApiPropertyOptional({ example: '1.5 ton' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  capacity?: string | null;

  @ApiPropertyOptional({ example: 'Master bedroom' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  installedLocation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  purchaseDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  installDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  manufacturerWarrantyUntil?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  photos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateMyApplianceDto extends PartialType(CreateMyApplianceDto) {}

// ---------------------------------------------------------------- uploads

export class PresignUploadDto {
  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  filename!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(80)
  contentType!: string;

  @ApiPropertyOptional({ description: 'Declared size in bytes; when sent it is enforced by the signature.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
