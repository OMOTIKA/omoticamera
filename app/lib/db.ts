"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";

export type PendingPhoto = {
  id: string;
  createdAt: number;
  nickname: string;
  blob: Blob;

  // ✅ 追加：ニックネーム変更を1回に制限するフラグ
  nicknameLocked?: boolean;
};

type OmoticameraDB = DBSchema & {
  pending: {
    key: string;
    value: PendingPhoto;
    indexes: { "by-createdAt": number };
  };
};

const DB_NAME = "omoticamera-db";
const DB_VERSION = 3;

let _dbPromise: Promise<IDBPDatabase<OmoticameraDB>> | null = null;

function getDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = openDB<OmoticameraDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending")) {
        const store = db.createObjectStore("pending", { keyPath: "id" });
        store.createIndex("by-createdAt", "createdAt");
      } else {
        const store = db.transaction("pending").objectStore("pending")!;

if (!store.indexNames.contains("by-createdAt")) {
  // ✅ 型定義上 createIndex が optional 扱いでも落ちないようにする
  (store as any).createIndex?.("by-createdAt", "createdAt");
}
      }
    },
  });

  return _dbPromise;
}

export async function addPending(p: PendingPhoto) {
  const db = await getDB();
  await db.put("pending", p);
}

export async function listPending(): Promise<PendingPhoto[]> {
  const db = await getDB();
  const all = await db.getAll("pending");
  all.sort((a, b) => b.createdAt - a.createdAt);
  return all;
}

// ✅ 追加：1件更新（putで上書き）
export async function updatePending(p: PendingPhoto) {
  const db = await getDB();
  await db.put("pending", p);
}

export async function markSent(id: string) {
  const db = await getDB();
  await db.delete("pending", id);
}

export async function deletePending(id: string) {
  const db = await getDB();
  await db.delete("pending", id);
}

// ✅ 既存：全部削除
export async function clearAllPending() {
  const db = await getDB();
  await db.clear("pending");
}

export async function resetLocalQueue() {
  indexedDB.deleteDatabase(DB_NAME);
  _dbPromise = null;
}