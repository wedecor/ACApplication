import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@ac/types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @ApiPropertyOptional({ description: 'Reason / context shown on the timeline.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
