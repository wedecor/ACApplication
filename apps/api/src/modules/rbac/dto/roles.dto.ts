import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], example: ['lead:view', 'booking:read'] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z_]+(:[a-z_]+)+$/, { each: true, message: 'each permission key must look like resource:action' })
  permissionKeys!: string[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 60 })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  @Matches(/\S/, { message: 'name must not be blank' })
  name?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class CreateRoleDto {
  @ApiProperty({ minLength: 2, maxLength: 60, example: 'Regional manager' })
  @IsString()
  @Length(2, 60)
  @Matches(/\S/, { message: 'name must not be blank' })
  name!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ type: [String], example: ['booking:read', 'customer:read'] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z_]+(:[a-z_]+)+$/, { each: true, message: 'each permission key must look like resource:action' })
  permissionKeys!: string[];
}
