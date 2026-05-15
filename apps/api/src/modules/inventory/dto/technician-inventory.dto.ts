import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { TechnicianStockStatus } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AllocateStockDto {
  @ApiProperty() @IsString() technicianId!: string;
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty() @IsString() sourceWarehouseId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) notes?: string;
}

export class UseStockDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) usedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) notes?: string;
}

export class ReturnStockDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) returnedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) notes?: string;
}

export class ReconcileStockDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) notes?: string;
}

export class ListTechStockDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() technicianId?: string;
  @ApiPropertyOptional({ enum: TechnicianStockStatus }) @IsOptional() @IsEnum(TechnicianStockStatus) status?: TechnicianStockStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() itemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
}
