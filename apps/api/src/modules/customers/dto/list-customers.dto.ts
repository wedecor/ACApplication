import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListCustomersDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ default: 'createdAt:desc', example: 'createdAt:desc' })
  @IsOptional()
  @IsString()
  sort?: string;
}
