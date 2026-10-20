import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Version } from './version.entity';
import {
  type ProjectSettings,
  defaultProjectSettings,
  projectSettingsTransformer,
} from './project-settings';

/**
 * A demo project — the unit a slug maps to. `currentVersionId` points at the
 * version served from `/<slug>/` and is a plain (non-FK) column to avoid a
 * cyclic constraint with `version.project_id`; integrity is maintained in the
 * service layer (delete-current repoints to the latest enabled version).
 */
@Entity({ name: 'project' })
export class Project extends BaseEntity {
  @Index('uq_project_slug', { unique: true })
  @Column({ type: 'varchar', length: 63 })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'current_version_id', type: 'uuid', nullable: true })
  currentVersionId!: string | null;

  /** Arbitrary project settings (e.g. comments/PageLoop). jsonb; see ProjectSettings. */
  @Column({ type: 'jsonb', default: () => "'{}'", transformer: projectSettingsTransformer })
  settings!: ProjectSettings;

  @OneToMany(() => Version, (v) => v.project)
  versions?: Version[];

  get settingsOrDefault(): ProjectSettings {
    return this.settings ?? defaultProjectSettings();
  }
}
