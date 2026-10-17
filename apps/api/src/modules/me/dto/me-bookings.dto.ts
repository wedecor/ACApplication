import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SERVICE_MODES = ['ON_SITE', 'PICKUP_DROP', 'CARRY_IN'] as const;
export type ServiceModeValue = (typeof SERVICE_MODES)[number];

export class ListMyBookingsDto {
  @ApiPropertyOptional({ enum: ['active', 'completed', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'completed', 'cancelled'])
  status?: 'active' | 'completed' | 'cancelled';
}

export class CreateMyBookingDto {
  @ApiProperty({ description: 'ServiceCategory (legacy app aliases are normalised).' })
  @IsString()
  @MaxLength(40)
  applianceCategory!: string;

  @ApiPropertyOptional({ description: 'Issue slug from the app catalogue, e.g. "no-cooling".' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  issueId?: string;

  @ApiPropertyOptional({ description: 'Human label of the issue, e.g. "AC not cooling".' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  issueLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ type: [String], description: 'Uploaded photo URLs (from /me/uploads/presign).' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  photoUrls?: string[];

  @ApiProperty({ description: 'Slot start (ISO).' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Slot end (ISO) — used to render the HH:MM-HH:MM window.' })
  @IsOptional()
  @IsISO8601()
  slotEnd?: string;

  @ApiPropertyOptional({ description: 'Display label of the slot, e.g. "Mon, 5 Oct • Morning".' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slotLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiProperty({ description: 'One of my saved addresses.' })
  @IsString()
  @MinLength(1)
  addressId!: string;

  @ApiPropertyOptional({ description: 'Alternate on-site contact (E.164).' })
  @IsOptional()
  @Matches(/^\+?\d{8,15}$/)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Registered appliance (must belong to me).' })
  @IsOptional()
  @IsString()
  applianceId?: string;

  @ApiPropertyOptional({ enum: SERVICE_MODES })
  @IsOptional()
  @IsIn(SERVICE_MODES)
  serviceMode?: ServiceModeValue;

  @ApiPropertyOptional({ description: 'Coupon code — stored; applied by the growth module.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;
}

export class RescheduleMyBookingDto {
  @ApiProperty()
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  slotEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelMyBookingDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}

export class AddMyBookingNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note!: string;
}

export class AddMyBookingPhotosDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  urls!: string[];
}

export class RateMyBookingDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  value!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  npsScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  photos?: string[];
}

export class MyBookingComplaintDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  reason!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  description!: string;
}

export class EstimateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  applianceCategory!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  issueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}

export class SlotsQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  applianceCategory!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiProperty({ example: '2026-10-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
}
