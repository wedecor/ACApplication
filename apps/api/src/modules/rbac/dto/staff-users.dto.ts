import { UserRole, UserStatus } from '@ac/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const PHONE_REGEX = /^\+\d{8,15}$/;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class ListStaffUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  roleKey?: UserRole;

  @ApiPropertyOptional({ enum: [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING] })
  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING])
  status?: UserStatus;

  @ApiPropertyOptional({
    default: false,
    description: 'Include technician accounts (normally managed on the Technicians page).',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeTechnicians?: boolean;
}

export class CreateStaffUserDto {
  @ApiProperty({ minLength: 1, maxLength: 60 })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'Phone and/or email is required (OTP login).' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(PHONE_REGEX, { message: 'phone must be E.164 (+countrycode...)' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: UserRole, isArray: true, description: 'Staff roles (not TECHNICIAN/CUSTOMER).' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roleKeys!: UserRole[];
}

export class UpdateStaffUserDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(PHONE_REGEX, { message: 'phone must be E.164 (+countrycode...)' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  email?: string;
}

export class SetUserRolesDto {
  @ApiProperty({ enum: UserRole, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roleKeys!: UserRole[];
}

export class AssignUserRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  roleKey!: UserRole;
}

export class DeactivateStaffUserDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
