import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator'
import { MovementReason } from './movement-reason.enum'

export class CreateMovementDto {
  @IsUUID()
  product_id!: string

  @IsOptional()
  @IsUUID()
  branch_id?: string | null

  @IsInt()
  @NotEquals(0)
  quantity_change!: number

  @IsEnum(MovementReason)
  reason!: MovementReason

  @IsOptional()
  @IsUUID()
  reference_id?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null
}
