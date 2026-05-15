import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleBookingDto {
  @ApiProperty({ description: 'New scheduled start time (ISO).' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: '10:00-12:00' })
  @IsOptional()
  @IsString()
  scheduledTimeSlot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
