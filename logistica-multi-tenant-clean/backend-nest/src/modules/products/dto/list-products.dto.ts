import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FilterProductDto } from './filter-product.dto';

export class ListProductsDto extends FilterProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'internalCode', 'quantity'])
  sortBy: 'createdAt' | 'updatedAt' | 'internalCode' | 'quantity' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
