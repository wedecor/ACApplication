import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualAssignDto {
  @ApiProperty()
  @IsString()
  bookingId!: string;

  @ApiProperty()
  @IsString()
  technicianId!: string;

  @ApiPropertyOptional({ description: 'Reason — surfaces on the timeline + audit log.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
