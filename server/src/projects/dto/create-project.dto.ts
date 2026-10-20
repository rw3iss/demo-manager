import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  /** Optional explicit slug; derived from `name` when omitted. */
  @IsOptional()
  @IsString()
  @Length(1, 63)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Inject the PageLoop comment widget into this project's published pages. */
  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;

  /** Required when commentsEnabled — the PageLoop project id the widget binds to. */
  @ValidateIf((o) => o.commentsEnabled === true)
  @IsString()
  @IsNotEmpty({ message: 'A PageLoop project id is required when comments are enabled.' })
  @MaxLength(200)
  pageloopProjectId?: string;
}
