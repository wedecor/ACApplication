import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PurchaseOrderStatus } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PurchaseOrderItemDto {
  @ApiProperty() @IsString() itemId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) unitCostMinor!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) gstRateBps?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorSku?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty() @IsString() vendorId!: string;
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) discountMinor?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) shippingMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expectedAt?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) discountMinor?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) shippingMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiPropertyOptional({ type: [PurchaseOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}

export class ListPurchaseOrdersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}

export class GrnLineItemDto {
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) unitCostMinor?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() batchNumber?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNumbers?: string[];
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expiryDate?: string;
}

export class CreateGoodsReceiptDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiProperty({ type: [GrnLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnLineItemDto)
  items!: GrnLineItemDto[];
}

export class CancelPurchaseOrderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) reason?: string;
}
