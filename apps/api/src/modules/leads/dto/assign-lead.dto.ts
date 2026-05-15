import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignLeadDto {
  @ApiProperty({ description: 'User id to assign the lead to.' })
  @IsString()
  assigneeUserId!: string;
}
