import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshSessionDto {
  @ApiProperty({ description: 'Opaque refresh token from OTP verify.' })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
