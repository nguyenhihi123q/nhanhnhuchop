// Lớp truy cập IndexedDB cho thư viện câu hỏi, phiên thi và metadata.
// Dùng raw IndexedDB để không phụ thuộc thêm thư viện; hoạt động với fake-indexeddb trong test.
import type { QuestionSet } from '../../domain/types';
import type { Session } from '../../domain/session';

export const DB_NAME = 'nhanh-nhu-chop-tinh-hoa';
export const DB_VERSION = 1;

export const STORE = {
  sets: 'sets',
  sessions: 'sessions',
  meta: 'meta',
} as const;

export type MetaRow = { key: string; value: unknown };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE.sets)) {
        db.createObjectStore(STORE.sets, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.sessions)) {
        db.createObjectStore(STORE.sessions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.meta)) {
        db.createObjectStore(STORE.meta, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Không mở được IndexedDB.'));
  });
  return dbPromise;
}

/** Cho phép test đặt lại kết nối (ví dụ sau khi đổi database). */
export function resetDbConnection(): void {
  dbPromise = null;
}

function tx<T>(
  store: (typeof STORE)[keyof typeof STORE],
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        const request = run(objectStore);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Lỗi thao tác dữ liệu.'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Giao dịch dữ liệu bị hủy.'));
      }),
  );
}

export function getAllSets(): Promise<QuestionSet[]> {
  return tx<QuestionSet[]>(STORE.sets, 'readonly', (s) => s.getAll() as IDBRequest<QuestionSet[]>);
}

export function putSet(set: QuestionSet): Promise<void> {
  return tx<void>(STORE.sets, 'readwrite', (s) => s.put(set) as unknown as IDBRequest<void>);
}

export function deleteSet(id: string): Promise<void> {
  return tx<void>(STORE.sets, 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<void>);
}

export function getAllSessions(): Promise<Session[]> {
  return tx<Session[]>(
    STORE.sessions,
    'readonly',
    (s) => s.getAll() as IDBRequest<Session[]>,
  );
}

export function putSession(session: Session): Promise<void> {
  return tx<void>(STORE.sessions, 'readwrite', (s) => s.put(session) as unknown as IDBRequest<void>);
}

export function deleteSession(id: string): Promise<void> {
  return tx<void>(STORE.sessions, 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<void>);
}

export function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  return tx<MetaRow | undefined>(STORE.meta, 'readonly', (s) => s.get(key) as IDBRequest<MetaRow | undefined>).then(
    (row) => row?.value as T | undefined,
  );
}

export function setMeta(key: string, value: unknown): Promise<void> {
  return tx<void>(
    STORE.meta,
    'readwrite',
    (s) => s.put({ key, value }) as unknown as IDBRequest<void>,
  );
}

/** Ghi nhiều bộ câu hỏi trong một transaction (dùng khi thay thế toàn bộ). */
export function replaceAllSets(sets: QuestionSet[]): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE.sets, 'readwrite');
        const store = transaction.objectStore(STORE.sets);
        store.clear();
        for (const set of sets) store.put(set);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Không ghi được dữ liệu.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Giao dịch bị hủy.'));
      }),
  );
}
