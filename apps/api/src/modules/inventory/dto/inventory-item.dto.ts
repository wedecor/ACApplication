import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { InventoryItemType, InventoryUnit } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateInventoryItemDto {
  @ApiPropertyOptional({ description: 'Auto-generated when omitted.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  barcode?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: InventoryItemType })
  @IsOptional()
  @IsEnum(InventoryItemType)
  type?: InventoryItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  compatibleApplianceCategories?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  compatibleBrands?: string[];

  @ApiPropertyOptional({ enum: InventoryUnit })
  @IsOptional()
  @IsEnum(InventoryUnit)
  unit?: InventoryUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellingPriceMinor?: number;

  @ApiPropertyOptional({ description: 'GST rate in basis points (1800 = 18.00%).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  gstRateBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hsnCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  serialTracking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  batchTracking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  shelfLifeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  warrantyDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredVendorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultReorderLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultReorderQty?: number;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: InventoryItemType }) @IsOptional() @IsEnum(InventoryItemType) type?: InventoryItemType;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) compatibleApplianceCategories?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) compatibleBrands?: string[];
  @ApiPropertyOptional({ enum: InventoryUnit }) @IsOptional() @IsEnum(InventoryUnit) unit?: InventoryUnit;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) costPriceMinor?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sellingPriceMinor?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) gstRateBps?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() hsnCode?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() serialTracking?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() batchTracking?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) shelfLifeDays?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) warrantyDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredVendorId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultReorderLevel?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultReorderQty?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class ListItemsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InventoryItemType })
  @IsOptional()
  @IsEnum(InventoryItemType)
  type?: InventoryItemType;

  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brand?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() warehouseId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vendorId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() lowStockOnly?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
}

export class StockAdjustmentDto {
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty({ description: 'Positive number to add, negative to remove' })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) unitCostMinor?: number;
  @ApiProperty() @IsString() @MaxLength(280) reason!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() externalRef?: string;
}

export class TransferRequestItemDto {
  @ApiProperty() @IsString() itemId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class CreateTransferDto {
  @ApiProperty() @IsString() sourceWarehouseId!: string;
  @ApiProperty() @IsString() destWarehouseId!: string;
  @ApiProperty({ type: [TransferRequestItemDto] })
  @IsArray()
  items!: TransferRequestItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ReceiveTransferItemDto {
  @ApiProperty() @IsString() transferItemId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) receivedQty!: number;
}

export class ReceiveTransferDto {
  @ApiProperty({ type: [ReceiveTransferItemDto] })
  @IsArray()
  items!: ReceiveTransferItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
