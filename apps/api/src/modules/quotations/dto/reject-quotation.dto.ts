import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for the customer's "Decline" action on the public quotation page. */
export class RejectQuotationDto {
  @ApiPropertyOptional({ maxLength: 500, example: 'Going with a cheaper option' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
