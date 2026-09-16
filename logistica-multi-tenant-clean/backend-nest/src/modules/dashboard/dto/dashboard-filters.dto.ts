import { IsOptional, IsDateString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DashboardFiltersDto {
  @ApiProperty({ required: false, enum: ['7d', '30d', '90d', '1y'] })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y'])
  period?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
