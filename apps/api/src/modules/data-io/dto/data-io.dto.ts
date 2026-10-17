import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'createdAt >= from (ISO date)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'createdAt <= to (ISO date)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Entity status enum value (leads, bookings, invoices, tasks).' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export const MAX_IMPORT_CSV_CHARS = 5_000_000;

export class ImportCsvDto {
  @ApiProperty({ description: 'Raw CSV text with a header row (max 5 MB, 5000 rows).' })
  @IsString()
  @MaxLength(MAX_IMPORT_CSV_CHARS)
  csv!: string;

  @ApiProperty({ default: true, description: 'Validate only; nothing is written.' })
  @IsBoolean()
  dryRun!: boolean;
}
