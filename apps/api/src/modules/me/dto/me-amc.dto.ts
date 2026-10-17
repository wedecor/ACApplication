import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class PurchaseAmcDto {
  @ApiProperty()
  @IsString()
  planId!: string;

  @ApiProperty({
    type: [String],
    description: 'Service categories (e.g. AC_REPAIR) and/or ids of my registered appliances.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  appliances!: string[];

  @ApiProperty()
  @IsString()
  addressId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
