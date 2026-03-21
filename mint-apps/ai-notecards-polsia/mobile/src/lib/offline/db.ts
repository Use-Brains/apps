import * as SQLite from 'expo-sqlite';
import { bootstrapOfflineDb } from './schema';
import type { OfflineDb } from './types';

let databasePromise: Promise<OfflineDb> | null = null;
let databaseOverride: OfflineDb | null = null;

async function openOfflineDb(): Promise<OfflineDb> {
  const db = await SQLite.openDatabaseAsync('offline-study.db');
  await bootstrapOfflineDb(db as OfflineDb);
  return db as OfflineDb;
}

export async function getOfflineDb(): Promise<OfflineDb> {
  if (databaseOverride) {
    return databaseOverride;
  }

  if (!databasePromise) {
    databasePromise = openOfflineDb();
  }

  return databasePromise;
}

export function setOfflineDbForTesting(db: OfflineDb | null) {
  databaseOverride = db;
  if (db === null) {
    databasePromise = null;
  }
}
