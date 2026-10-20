import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { bigintToNumber } from '../common/util/bigint.transformer';
import { Project } from './project.entity';

/**
 * A published version of a project. `number` is per-project sequential (1, 2, …)
 * and is the public ref used in `/<slug>/<number>/`. Files live on disk at
 * `DEMOS_ROOT/<slug>/<number>/`; this row is the metadata/index.
 */
@Entity({ name: 'version' })
@Unique('uq_version_project_number', ['projectId', 'number'])
export class Version extends BaseEntity {
  @Index('idx_version_project')
  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @ManyToOne(() => Project, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project?: Project;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name!: string | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ name: 'size_bytes', type: 'bigint', transformer: bigintToNumber, default: 0 })
  sizeBytes!: number;

  @Column({ name: 'file_count', type: 'int', default: 0 })
  fileCount!: number;
}
