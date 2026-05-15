import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignTechnicianDto {
  @ApiPropertyOptional({
    description: 'Explicit technician id. Omit + set autoPick=true to let the engine choose.',
  })
  @IsOptional()
  @IsString()
  technicianId?: string;

  @ApiPropertyOptional({
    description: 'Run the scoring engine and pick the best candidate.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoPick?: boolean;

  @ApiPropertyOptional({ description: 'Optional override reason for the timeline.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
