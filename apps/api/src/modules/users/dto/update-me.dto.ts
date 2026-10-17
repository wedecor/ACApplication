import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ nullable: true, description: 'URL from /uploads/presign, or null to clear.' })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  avatarUrl?: string | null;
}
