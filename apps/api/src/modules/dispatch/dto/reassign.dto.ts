import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReassignDto {
  @ApiProperty()
  @IsString()
  bookingId!: string;

  @ApiPropertyOptional({ description: 'Explicit replacement; omit + autoPick=true for engine choice.' })
  @IsOptional()
  @IsString()
  toTechnicianId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoPick?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
