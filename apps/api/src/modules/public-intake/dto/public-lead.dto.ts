import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, ServiceCategory } from '@ac/types';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const PHONE_REGEX = /^\+\d{8,15}$/;

/**
 * Public-website lead intake DTO. Narrower than the internal
 * `CreateLeadDto` — fields that only operations should set
 * (priority, externalRef, tags) are not exposed here.
 *
 * `honeypot` is a hidden field; any non-empty value will fail validation
 * and the lead will not be persisted. Adds a free baseline of
 * spam-bot filtering on top of the rate limiter.
 */
export class PublicLeadIntakeDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  customerName!: string;

  @ApiProperty({ example: '+919876543210', description: 'E.164 phone number.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(PHONE_REGEX, { message: 'phone must be E.164 (+countrycode...)' })
  phone!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Matches(PHONE_REGEX, { message: 'whatsappNumber must be E.164' })
  whatsappNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory)
  applianceType?: ServiceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  applianceBrand?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issueDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4,8}$/)
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  geoLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  geoLongitude?: number;

  @ApiPropertyOptional({
    enum: LeadSource,
    description: 'Optional override for attribution (WEBSITE / WHATSAPP / GOOGLE_ADS / FACEBOOK / INSTAGRAM).',
  })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({
    description: 'Origin URL (e.g. /lp/ac-repair-bangalore?kw=ac+repair). Stored for attribution.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  originUrl?: string;

  @ApiPropertyOptional({
    description:
      'UTM source / campaign payload. Kept loose-typed; persisted in the activity timeline metadata.',
  })
  @IsOptional()
  utm?: Record<string, string>;

  /**
   * Honeypot — must be blank. Real users won't see this field (it's
   * hidden via CSS); bots will fill it indiscriminately.
   */
  @ApiPropertyOptional({ description: 'Honeypot — leave blank.' })
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'spam' })
  hp_url?: string;
}
