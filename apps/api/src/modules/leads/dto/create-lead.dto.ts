import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type LeadPriority, LeadSource, type ServiceCategory } from '@ac/types';
import { Transform } from 'class-transformer';
import {
  IsArray,
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

export class CreateLeadDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  customerName!: string;

  @ApiProperty({ example: '+919876543210' })
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

  @ApiProperty({ enum: LeadSource })
  @IsEnum(LeadSource)
  source!: LeadSource;

  @ApiPropertyOptional({
    description: 'Maps to ServiceCategory at conversion.',
    enum: ['AC_REPAIR', 'AC_INSTALLATION', 'AC_SERVICING', 'REFRIGERATOR', 'WASHING_MACHINE', 'MICROWAVE', 'GEYSER', 'CHIMNEY', 'OTHER'],
  })
  @IsOptional()
  @IsString()
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
  @MaxLength(200)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityLabel?: string;

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

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] })
  @IsOptional()
  @IsString()
  priority?: LeadPriority;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v: string) => v.trim().toLowerCase()) : value))
  tags?: string[];

  @ApiPropertyOptional({ description: 'External integration idempotency key.' })
  @IsOptional()
  @IsString()
  externalRef?: string;
}
