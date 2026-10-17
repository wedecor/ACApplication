import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength, ValidateNested } from 'class-validator';

/** Device fingerprint sent by the mobile apps — used to label sessions. */
export class VerifyOtpDeviceDto {
  @IsOptional() @IsString() @MaxLength(128) deviceId?: string;
  @IsOptional() @IsString() @MaxLength(32) platform?: string;
  @IsOptional() @IsString() @MaxLength(120) modelName?: string;
  @IsOptional() @IsString() @MaxLength(40) osVersion?: string;
  @IsOptional() @IsString() @MaxLength(40) appVersion?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210' })
  @Matches(/^\+\d{8,15}$/, { message: 'destination must be E.164' })
  destination!: string;

  @ApiProperty({ minLength: 4, maxLength: 8 })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({ type: VerifyOtpDeviceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VerifyOtpDeviceDto)
  device?: VerifyOtpDeviceDto;
}
