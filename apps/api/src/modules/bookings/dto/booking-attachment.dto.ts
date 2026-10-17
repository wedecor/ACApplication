import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingAttachmentKind } from '@ac/types';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

/** Storage URLs: http(s) only; no TLD required so local MinIO (localhost:9000) works. */
const STORAGE_URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };

export class AddBookingAttachmentDto {
  @ApiProperty({ enum: BookingAttachmentKind })
  @IsEnum(BookingAttachmentKind)
  kind!: BookingAttachmentKind;

  @ApiProperty({ description: 'Pre-signed object URL (must already be uploaded).' })
  @IsUrl(STORAGE_URL_OPTIONS)
  url!: string;

  @ApiProperty({ description: 'Object key in storage (S3-compatible).' })
  @IsString()
  storageKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}

export class AddSignatureDto {
  @ApiProperty({ description: 'Storage URL of the captured signature image.' })
  @IsUrl(STORAGE_URL_OPTIONS)
  url!: string;
}
