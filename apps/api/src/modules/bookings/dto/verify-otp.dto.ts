import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class VerifyBookingOtpDto {
  @ApiProperty({ description: '4-8 digit OTP delivered to the customer.' })
  @Matches(/^\d{4,8}$/)
  code!: string;
}
