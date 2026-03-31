import { IsEmail, IsString, MaxLength } from 'class-validator';

export class RequestCodeDto {
  @IsString()
  @IsEmail()
  @MaxLength(320)
  email!: string;
}