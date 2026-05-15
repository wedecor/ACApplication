import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { KbArticleStatus, KbVisibility } from '@ac/types';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateKbCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordering?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateKbCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordering?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class CreateKbArticleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  slug!: string;

  @IsString()
  @MinLength(1)
  bodyMarkdown!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(KbArticleStatus)
  status?: KbArticleStatus;

  @IsOptional()
  @IsEnum(KbVisibility)
  visibility?: KbVisibility;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateKbArticleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  bodyMarkdown?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(KbArticleStatus)
  status?: KbArticleStatus;

  @IsOptional()
  @IsEnum(KbVisibility)
  visibility?: KbVisibility;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[];
}

export class ListKbArticlesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(KbArticleStatus, { each: true })
  @IsArray()
  status?: KbArticleStatus[];

  @IsOptional()
  @IsEnum(KbVisibility, { each: true })
  @IsArray()
  visibility?: KbVisibility[];

  @IsOptional()
  @IsString()
  tag?: string;
}

export class KbFeedbackDto {
  @IsBoolean()
  helpful!: boolean;
}
