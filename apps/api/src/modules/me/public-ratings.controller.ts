import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators';
import { PublicRateBookingDto } from './dto/public-rating.dto';
import { PublicRatingsService } from './public-ratings.service';

@ApiTags('public-ratings')
@Controller({ path: 'public/ratings', version: '1' })
export class PublicRatingsController {
  constructor(private readonly ratings: PublicRatingsService) {}

  @Get(':token')
  @Public()
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Visit summary for the signed "rate your visit" link.' })
  view(@Param('token') token: string) {
    return this.ratings.view(token);
  }

  @Post(':token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rate a completed visit from the signed review-request link.' })
  rate(@Param('token') token: string, @Body() dto: PublicRateBookingDto) {
    return this.ratings.rate(token, dto);
  }
}
