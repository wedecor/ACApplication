import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LocationPingDto {
  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'Horizontal accuracy in metres.' })
  @IsOptional()
  @Type(() => Number)
  accuracyM?: number;

  @ApiPropertyOptional({ description: 'Bearing in degrees (0..360).' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ description: 'Speed in m/s.' })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  speedMps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  altitudeM?: number;

  @ApiPropertyOptional({ description: '0..100' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBackground?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  wasOffline?: boolean;

  @ApiProperty({ description: 'ISO timestamp at device capture.' })
  @IsISO8601()
  recordedAt!: string;

  @ApiPropertyOptional({ description: 'HMAC-SHA256 over (deviceId|techId|lat|lng|recordedAt).' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({ enum: ['expo-foreground', 'expo-background', 'simulator', 'tcp'] })
  @IsOptional()
  @IsString()
  source?: string;
}

/**
 * Upload payload — supports both single ping and batched offline-queue
 * flushes (the mobile app drains its queue when connectivity returns).
 */
export class UploadLocationDto {
  @ApiProperty({ type: [LocationPingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationPingDto)
  pings!: LocationPingDto[];
}
