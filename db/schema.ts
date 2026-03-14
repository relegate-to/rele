import { sql } from 'drizzle-orm';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  pgPolicy('users can only access their own api keys', {
    for: 'all',
    to: authenticatedRole,
    using: sql`user_id = (select auth.jwt()->>'sub')`,
  }),
]);
