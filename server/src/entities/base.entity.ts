import { randomUUID } from 'node:crypto';
import { BeforeInsert, BeforeUpdate, Column, PrimaryColumn } from 'typeorm';
import { bigintToNumber } from '../common/util/bigint.transformer';
import { nowSeconds } from '../common/util/time';

/**
 * Shared id + timestamp columns. UUIDs are generated app-side
 * (`crypto.randomUUID`) so we need no Postgres extension; timestamps are Unix
 * epoch seconds (platform convention) maintained via lifecycle hooks.
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'created_at', type: 'bigint', transformer: bigintToNumber })
  createdAt!: number;

  @Column({ name: 'updated_at', type: 'bigint', transformer: bigintToNumber })
  updatedAt!: number;

  @BeforeInsert()
  protected onInsert(): void {
    if (!this.id) this.id = randomUUID();
    const now = nowSeconds();
    this.createdAt ??= now;
    this.updatedAt = now;
  }

  @BeforeUpdate()
  protected onUpdate(): void {
    this.updatedAt = nowSeconds();
  }
}
