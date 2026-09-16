import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FilterTransportDto } from './filter-transport.dto';

export class ListTransportsDto extends FilterTransportDto {
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
  @IsIn(['createdAt', 'departureDate', 'estimatedArrival', 'internalCode'])
  sortBy: 'createdAt' | 'departureDate' | 'estimatedArrival' | 'internalCode' =
    'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
