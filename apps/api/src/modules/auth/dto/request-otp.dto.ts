import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, Matches } from 'class-validator';

export enum OtpPurpose {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
  PHONE_CHANGE = 'PHONE_CHANGE',
}

export class RequestOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Matches(/^\+\d{8,15}$/, { message: 'destination must be an E.164 phone or email' })
  destination!: string;

  @ApiProperty({ enum: OtpPurpose, required: false })
  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
