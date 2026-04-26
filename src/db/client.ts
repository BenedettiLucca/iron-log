import { logger } from '@/services/logger';
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

const expoDb = openDatabaseSync("ironlog.db");

// Configure SQLite for safety and performance
try {
  expoDb.execSync("PRAGMA journal_mode = WAL;");
  expoDb.execSync("PRAGMA foreign_keys = ON;");
  expoDb.execSync("PRAGMA busy_timeout = 5000;");
} catch (e) {
  logger.error("Failed to set PRAGMA", e);
}

export const db = drizzle(expoDb, { schema });
