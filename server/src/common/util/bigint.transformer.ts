import type { ValueTransformer } from 'typeorm';

/**
 * Postgres `bigint` is returned as a string by the driver to avoid precision
 * loss. Our bigints (epoch seconds, byte sizes) are always within JS safe
 * integer range, so transform to/from `number` for ergonomics.
 */
export const bigintToNumber: ValueTransformer = {
  to: (value?: number | null): number | null => (value === undefined || value === null ? null : value),
  from: (value?: string | null): number | null => (value === undefined || value === null ? null : Number(value)),
};
