import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SlaProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsInt()
  @Min(1)
  firstResponseMinutes!: number;

  @IsInt()
  @Min(1)
  resolutionMinutes!: number;

  @IsOptional()
  @IsBoolean()
  businessHoursOnly?: boolean;

  @IsOptional()
  @IsObject()
  priorityOverrides?: Record<
    string,
    { firstResponseMinutes?: number; resolutionMinutes?: number }
  >;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
