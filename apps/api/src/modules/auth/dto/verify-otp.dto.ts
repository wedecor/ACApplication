import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Matches(/^\+\d{8,15}$/, { message: 'destination must be E.164' })
  destination!: string;

  @ApiProperty({ minLength: 4, maxLength: 8 })
  @IsString()
  @Length(4, 8)
  code!: string;
}
