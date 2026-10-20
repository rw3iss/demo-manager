import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
