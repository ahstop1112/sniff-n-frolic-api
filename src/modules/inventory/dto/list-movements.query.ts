import { Type } from 'class-transformer'
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator'
import { MovementReason } from './movement-reason.enum'

export class ListMovementsQuery {
  @IsOptional()
  @IsUUID()
  product_id?: string

  @IsOptional()
  @IsUUID()
  branch_id?: string

  @IsOptional()
  @IsEnum(MovementReason)
  reason?: MovementReason

  @IsOptional()
  @IsISO8601()
  date_from?: string

  @IsOptional()
  @IsISO8601()
  date_to?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number
}
