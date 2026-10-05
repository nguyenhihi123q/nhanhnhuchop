// Migration schema cho dữ liệu lưu trong IndexedDB.
// Hiện tại schemaVersion = 1; hàm giữ chỗ cho nâng cấp về sau.
import { SCHEMA_VERSION, type QuestionSet } from '../../domain/types';

export function migrateSet(raw: unknown): QuestionSet {
  const set = raw as QuestionSet;
  const version = typeof set.schemaVersion === 'number' ? set.schemaVersion : 1;
  // Từ 1 lên SCHEMA_VERSION: hiện chưa có thay đổi cấu trúc.
  void version;
  return { ...set, schemaVersion: SCHEMA_VERSION };
}

export function migrateAllSets(raw: unknown[]): QuestionSet[] {
  return raw.map(migrateSet);
}
