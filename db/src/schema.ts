import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
