import {
  CommissionType,
  PayoutCycle,
  ServiceCategory,
  TechnicianStatus,
  UserStatus,
} from '@ac/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

const PHONE_REGEX = /^\+\d{8,15}$/;
const EMPLOYEE_CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

function toArray(value: unknown): unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upperTrim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** Pointer to a KYC / licence document stored elsewhere (S3, Drive…). */
export class TechnicianDocumentDto {
  @ApiProperty({ example: 'AADHAAR', description: 'Document kind, e.g. AADHAAR, PAN, LICENSE.' })
  @IsString()
  @Length(1, 40)
  type!: string;

  @ApiProperty({ example: 'https://files.example.com/kyc/abc.pdf' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(1000)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ description: 'ISO date the document expires.' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class CreateTechnicianDto {
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

  @ApiProperty({ example: '+919876543210', description: 'Login phone (OTP). Must be unique.' })
  @Transform(trim)
  @Matches(PHONE_REGEX, { message: 'phone must be E.164 (+countrycode...)' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiPropertyOptional({ description: 'Auto-generated (TECH-00001) when omitted.' })
  @IsOptional()
  @Transform(upperTrim)
  @Matches(EMPLOYEE_CODE_REGEX, { message: 'employeeCode must be 2-32 chars of A-Z, 0-9 or -' })
  employeeCode?: string;

  @ApiProperty({ enum: ServiceCategory, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsEnum(ServiceCategory, { each: true })
  skills!: ServiceCategory[];

  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dailyCapacity?: number;

  @ApiPropertyOptional({
    description: 'Local-time windows per weekday: { mon: [["09:00","18:00"]], ... }',
    example: { mon: [['09:00', '18:00']] },
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, [string, string][]>;

  @ApiPropertyOptional({ type: [TechnicianDocumentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TechnicianDocumentDto)
  documents?: TechnicianDocumentDto[];
}

export class UpdateTechnicianDto {
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
  @Transform(trim)
  @Matches(PHONE_REGEX, { message: 'phone must be E.164 (+countrycode...)' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upperTrim)
  @Matches(EMPLOYEE_CODE_REGEX, { message: 'employeeCode must be 2-32 chars of A-Z, 0-9 or -' })
  employeeCode?: string;

  @ApiPropertyOptional({ enum: ServiceCategory, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsEnum(ServiceCategory, { each: true })
  skills?: ServiceCategory[];

  @ApiPropertyOptional({ minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  dailyCapacity?: number;

  @ApiPropertyOptional({ example: { mon: [['09:00', '18:00']] } })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, [string, string][]>;

  @ApiPropertyOptional({ type: [TechnicianDocumentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TechnicianDocumentDto)
  documents?: TechnicianDocumentDto[];
}

export const TECHNICIAN_SORT_FIELDS = ['createdAt', 'fullName', 'rating', 'totalJobs', 'employeeCode'] as const;

export class ListTechniciansDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ enum: TechnicianStatus, isArray: true, description: 'Presence status.' })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(TechnicianStatus, { each: true })
  status?: TechnicianStatus[];

  @ApiPropertyOptional({
    enum: [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING],
    description: 'Account status (ACTIVE = can log in, SUSPENDED = deactivated).',
  })
  @IsOptional()
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING])
  accountStatus?: UserStatus;

  @ApiPropertyOptional({ enum: ServiceCategory, isArray: true, description: 'Has ANY of these skills.' })
  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsArray()
  @IsEnum(ServiceCategory, { each: true })
  skill?: ServiceCategory[];

  @ApiPropertyOptional({ example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class DeactivateTechnicianDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Deactivate even if the technician still has open bookings (they stay assigned and must be re-dispatched).',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class ListTechnicianSubresourceDto extends PaginationDto {}

export class UpsertTechnicianCommissionRuleDto {
  @ApiProperty({ enum: CommissionType })
  @IsEnum(CommissionType)
  type!: CommissionType;

  @ApiProperty({
    description: 'FLAT/PER_JOB: minor units per booking. PERCENTAGE: basis points (6000 = 60%).',
  })
  @IsInt()
  @Min(0)
  valueMinor!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bonusMinor?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  penaltyPerLateMinuteMinor?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPayoutMinor?: number;

  @ApiPropertyOptional({ enum: PayoutCycle, default: PayoutCycle.WEEKLY })
  @IsOptional()
  @IsEnum(PayoutCycle)
  payoutCycle?: PayoutCycle;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, default: 6, description: '0=Mon..6=Sun' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  cycleClosesOn?: number;
}
