import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TechnicianStatus } from '@ac/types';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeTechnicianStatusDto {
  @ApiProperty({ enum: TechnicianStatus })
  @IsEnum(TechnicianStatus)
  status!: TechnicianStatus;

  @ApiPropertyOptional({ description: 'Optional reason — captured on the timeline.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
