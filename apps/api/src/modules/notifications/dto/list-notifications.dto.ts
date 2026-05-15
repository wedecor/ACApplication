import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationStatus })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ description: 'Search template, recipient, correlation, or provider ref' })
  @IsOptional()
  @IsString()
  override search?: string;
}
