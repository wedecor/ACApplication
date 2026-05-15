import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { CreateBookingDto } from './create-booking.dto';

export class ConvertLeadDto {
  @ApiProperty({ type: CreateBookingDto })
  @ValidateNested()
  @Type(() => CreateBookingDto)
  booking!: CreateBookingDto;
}
