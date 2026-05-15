import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { CommissionType, PayoutCycle } from '@ac/types';

export class UpsertCommissionRuleDto {
  @IsEnum(CommissionType as Record<string, string>)
  type!: CommissionType;

  @IsInt()
  @Min(0)
  valueMinor!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bonusMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  penaltyPerLateMinuteMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPayoutMinor?: number;

  @IsOptional()
  @IsEnum(PayoutCycle as Record<string, string>)
  payoutCycle?: PayoutCycle;
}

export class AdjustCommissionDto {
  @IsInt()
  adjustmentMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePayoutDto {
  @IsString()
  technicianId!: string;

  /** ISO date for cycle start. Defaults to last Monday. */
  @IsOptional()
  @IsString()
  periodStart?: string;

  @IsOptional()
  @IsString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ApprovePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class MarkPayoutPaidDto {
  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
