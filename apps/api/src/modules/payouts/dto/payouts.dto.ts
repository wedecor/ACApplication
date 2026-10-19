import { CommissionType, PayoutCycle } from '@ac/types';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertCommissionRuleDto {
  @IsEnum(CommissionType)
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
  @IsEnum(PayoutCycle)
  payoutCycle?: PayoutCycle;
}

export class AdjustCommissionDto {
  /** Signed paise; one adjustment is capped at ±₹1,00,000 to catch typos. */
  @IsInt()
  @Min(-10_000_000)
  @Max(10_000_000)
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

export class FailPayoutDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
