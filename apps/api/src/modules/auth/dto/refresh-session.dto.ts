import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshSessionDto {
  @ApiPropertyOptional({ description: 'Opaque refresh token from OTP verify (omit when using the httpOnly cookie).' })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
