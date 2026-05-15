import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { type BookingPriority, ServiceCategory } from '@ac/types';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookingAddressDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  city!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  state!: string;

  @ApiProperty()
  @Matches(/^\d{4,8}$/)
  pincode!: string;

  @ApiPropertyOptional({ default: 'IN' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateBookingDto {
  @ApiPropertyOptional({ description: 'Origin lead. Set when converting a lead.' })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiProperty({ enum: ServiceCategory })
  @IsEnum(ServiceCategory)
  category!: ServiceCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  applianceBrand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  applianceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issueDescription?: string;

  @ApiProperty({ description: 'ISO timestamp for the slot start time.' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: '10:00-12:00' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  scheduledTimeSlot?: string;

  @ApiPropertyOptional({ enum: ['STANDARD', 'PRIORITY', 'EMERGENCY'] })
  @IsOptional()
  @IsString()
  priority?: BookingPriority;

  @ApiPropertyOptional({ default: 0, description: 'Estimated price in minor units.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedAmountMinor?: number;

  @ApiProperty({ type: BookingAddressDto })
  @ValidateNested()
  @Type(() => BookingAddressDto)
  address!: BookingAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  geoLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  geoLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Existing customer addressId; if omitted, a new Address is created from the snapshot.' })
  @IsOptional()
  @IsString()
  addressId?: string;
}
