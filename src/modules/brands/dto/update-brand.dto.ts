import { IsString, IsNotEmpty } from 'class-validator'

export class UpdateBrandDto {
  @IsString()
  @IsNotEmpty()
  name!: string
}