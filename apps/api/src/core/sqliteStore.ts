// True SQLite database engine for local persistence, replacing in-memory RAM
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.resolve(DATA_DIR, 'school_intelligence.db');
const LEGACY_JSON = path.resolve(__dirname, '../../.local-db.json');

function resolveFieldValues(target: any, patch: any): any {
  if (!patch || typeof patch !== 'object') return patch;
  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object') {
      // Check for FieldValue.serverTimestamp
      if (
        (value as any)._methodName === 'serverTimestamp' ||
        (value as any).constructor?.name === 'ServerTimestamp'
      ) {
        result[key] = new Date().toISOString();
        continue;
      }
      // Check for FieldValue.arrayUnion
      if (
        (value as any)._methodName === 'arrayUnion' ||
        Array.isArray((value as any)._elements) ||
        Array.isArray((value as any).elements)
      ) {
        const existingArr = Array.isArray(result[key])
          ? result[key]
          : (result[key]?.elements && Array.isArray(result[key].elements) ? result[key].elements : []);
        const toAdd = (value as any)._elements || (value as any).elements || [];
        result[key] = Array.from(new Set([...existingArr, ...toAdd]));
        continue;
      }
      // Check for FieldValue.arrayRemove
      if (
        (value as any)._methodName === 'arrayRemove' ||
        (value as any).constructor?.name === 'ArrayRemove'
      ) {
        const existingArr = Array.isArray(result[key]) ? result[key] : [];
        const toRemove = new Set((value as any)._elements || (value as any).elements || []);
        result[key] = existingArr.filter((x: any) => !toRemove.has(x));
        continue;
      }
      // Check for FieldValue.increment
      if (
        (value as any)._methodName === 'increment' ||
        typeof (value as any)._operand === 'number'
      ) {
        const prev = Number(result[key]) || 0;
        result[key] = prev + ((value as any)._operand || 0);
        continue;
      }
      // Check for FieldValue.delete
      if (
        (value as any)._methodName === 'delete' ||
        (value as any).constructor?.name === 'DeleteTransform'
      ) {
        delete result[key];
        continue;
      }
      // Unwrap objects that only contain { elements: [...] }
      if (Array.isArray((value as any).elements) && Object.keys(value).length === 1) {
        result[key] = (value as any).elements;
        continue;
      }
    }

    // Support dot-notation nested paths like 'content.completionRate'
    if (key.includes('.')) {
      const parts = key.split('.');
      let cur: any = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i] as string;
        if (!cur[p] || typeof cur[p] !== 'object') {
          cur[p] = {};
        }
        cur = cur[p];
      }
      const lastKey = parts[parts.length - 1] as string;
      cur[lastKey] = value;
      continue;
    }

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = resolveFieldValues(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function unwrapElements(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(unwrapElements);
  if (Array.isArray(obj.elements) && Object.keys(obj).length === 1) return obj.elements.map(unwrapElements);
  const res: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && Array.isArray((v as any).elements) && Object.keys(v).length === 1) {
      res[k] = (v as any).elements.map(unwrapElements);
    } else {
      res[k] = unwrapElements(v);
    }
  }
  return res;
}

export class SqliteDocRef {
  constructor(
    public id: string,
    public collectionPath: string,
    private db: SqliteDb
  ) {}

  get path(): string {
    return `${this.collectionPath}/${this.id}`;
  }

  get firestore(): SqliteDb {
    return this.db;
  }

  collection(subName: string): SqliteCollectionRef {
    return this.db.collection(`${this.collectionPath}/${this.id}/${subName}`);
  }

  async get() {
    const raw = this.db.getRawDoc(this.collectionPath, this.id);
    if (!raw) {
      return {
        id: this.id,
        ref: this,
        exists: false,
        data: () => undefined
      };
    }
    const data = unwrapElements(JSON.parse(raw.data));
    return {
      id: this.id,
      ref: this,
      exists: true,
      data: () => JSON.parse(JSON.stringify(data))
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    let finalData = data;
    if (options?.merge) {
      const existingRaw = this.db.getRawDoc(this.collectionPath, this.id);
      const existing = existingRaw ? JSON.parse(existingRaw.data) : {};
      finalData = resolveFieldValues(existing, data);
    } else {
      finalData = resolveFieldValues({}, data);
    }
    this.db.saveDoc(this.collectionPath, this.id, finalData);
  }

  async update(data: any) {
    const existingRaw = this.db.getRawDoc(this.collectionPath, this.id);
    const existing = existingRaw ? JSON.parse(existingRaw.data) : {};
    const finalData = resolveFieldValues(existing, data);
    this.db.saveDoc(this.collectionPath, this.id, finalData);
  }

  async delete() {
    this.db.deleteDoc(this.collectionPath, this.id);
  }
}

export class SqliteQuery {
  constructor(
    protected db: SqliteDb,
    protected collectionPath: string,
    protected filters: ((doc: any) => boolean)[] = [],
    protected limitCount?: number,
    protected orderField?: string,
    protected orderDirection: 'asc' | 'desc' = 'asc'
  ) {}

  where(field: string, op: string, value: any): SqliteQuery {
    const filter = (data: any) => {
      const val = field.includes('.')
        ? field.split('.').reduce((o, k) => o?.[k], data)
        : data[field];

      if (op === '==') return val === value;
      if (op === '!=') return val !== value;
      if (op === '>') return val > value;
      if (op === '>=') return val >= value;
      if (op === '<') return val < value;
      if (op === '<=') return val <= value;
      if (op === 'in') return Array.isArray(value) && value.includes(val);
      if (op === 'array-contains') return Array.isArray(val) && val.includes(value);
      return true;
    };
    return new SqliteQuery(
      this.db,
      this.collectionPath,
      [...this.filters, filter],
      this.limitCount,
      this.orderField,
      this.orderDirection
    );
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): SqliteQuery {
    return new SqliteQuery(
      this.db,
      this.collectionPath,
      this.filters,
      this.limitCount,
      field,
      direction
    );
  }

  limit(count: number): SqliteQuery {
    return new SqliteQuery(
      this.db,
      this.collectionPath,
      this.filters,
      count,
      this.orderField,
      this.orderDirection
    );
  }

  count() {
    return {
      get: async () => {
        const snap = await this.get();
        return {
          data: () => ({ count: snap.size })
        };
      }
    };
  }

  async get() {
    const rows = this.db.getCollectionDocs(this.collectionPath);
    let items: Array<{ id: string; data: any }> = [];

    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.data);
        const resolved = unwrapElements(parsed);
        let match = true;
        for (const f of this.filters) {
          if (!f(resolved)) {
            match = false;
            break;
          }
        }
        if (match) {
          items.push({ id: r.doc_id, data: resolved });
        }
      } catch {}
    }

    if (this.orderField) {
      const field = this.orderField;
      const asc = this.orderDirection === 'asc';
      items.sort((a, b) => {
        const va = a.data?.[field];
        const vb = b.data?.[field];
        if (va === vb) return 0;
        if (va === undefined || va === null) return asc ? -1 : 1;
        if (vb === undefined || vb === null) return asc ? 1 : -1;
        return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      });
    }

    if (this.limitCount && this.limitCount > 0) {
      items = items.slice(0, this.limitCount);
    }

    const docs = items.map((it) => {
      const docRef = new SqliteDocRef(it.id, this.collectionPath, this.db);
      return {
        id: it.id,
        ref: docRef,
        exists: true,
        data: () => JSON.parse(JSON.stringify(it.data))
      };
    });

    return {
      empty: docs.length === 0,
      size: docs.length,
      docs
    };
  }
}

export class SqliteCollectionRef extends SqliteQuery {
  constructor(db: SqliteDb, collectionPath: string) {
    super(db, collectionPath);
  }

  doc(id?: string): SqliteDocRef {
    const docId = id || crypto.randomUUID();
    return new SqliteDocRef(docId, this.collectionPath, this.db);
  }

  async add(data: any): Promise<SqliteDocRef> {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

export class SqliteBatch {
  private ops: Array<() => void> = [];

  constructor(private db: SqliteDb) {}

  set(docRef: SqliteDocRef, data: any, options?: { merge?: boolean }) {
    this.ops.push(() => {
      let finalData = data;
      if (options?.merge) {
        const existingRaw = this.db.getRawDoc(docRef.collectionPath, docRef.id);
        const existing = existingRaw ? JSON.parse(existingRaw.data) : {};
        finalData = resolveFieldValues(existing, data);
      } else {
        finalData = resolveFieldValues({}, data);
      }
      this.db.saveDoc(docRef.collectionPath, docRef.id, finalData);
    });
    return this;
  }

  update(docRef: SqliteDocRef, data: any) {
    this.ops.push(() => {
      const existingRaw = this.db.getRawDoc(docRef.collectionPath, docRef.id);
      const existing = existingRaw ? JSON.parse(existingRaw.data) : {};
      const finalData = resolveFieldValues(existing, data);
      this.db.saveDoc(docRef.collectionPath, docRef.id, finalData);
    });
    return this;
  }

  delete(docRef: SqliteDocRef) {
    this.ops.push(() => {
      this.db.deleteDoc(docRef.collectionPath, docRef.id);
    });
    return this;
  }

  async commit() {
    this.db.runTransactionSync(() => {
      for (const op of this.ops) {
        op();
      }
    });
  }
}

export class SqliteBulkWriter {
  constructor(private db: SqliteDb) {}

  async set(docRef: any, data: any, options?: any) {
    await docRef.set(data, options);
  }

  async update(docRef: any, data: any) {
    await docRef.update(data);
  }

  async delete(docRef: any) {
    await docRef.delete();
  }

  async flush() {}
  async close() {}
}

export class SqliteDb {
  private sql: Database.Database;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.sql = new Database(DB_FILE);

    // Bật chế độ WAL (Write-Ahead Logging) cho tốc độ đọc/ghi cực nhanh và an toàn tuyệt đối
    this.sql.pragma('journal_mode = WAL');
    this.sql.pragma('synchronous = NORMAL');

    this.initTables();
    this.migrateFromLegacyJson();
  }

  private initTables() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        collection_path TEXT NOT NULL,
        doc_id          TEXT NOT NULL,
        data            TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        PRIMARY KEY (collection_path, doc_id)
      );

      CREATE INDEX IF NOT EXISTS idx_docs_collection ON documents(collection_path);
      CREATE INDEX IF NOT EXISTS idx_docs_updated_at ON documents(updated_at);

      CREATE TABLE IF NOT EXISTS system_kv (
        key        TEXT PRIMARY KEY,
        val        TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  private migrateFromLegacyJson() {
    try {
      const rowCount = (this.sql.prepare('SELECT COUNT(*) as cnt FROM documents').get() as any)?.cnt || 0;
      if (rowCount === 0 && fs.existsSync(LEGACY_JSON)) {
        console.log('[SqliteDb] Đang tự động chuyển dữ liệu từ .local-db.json sang SQLite database...');
        const raw = fs.readFileSync(LEGACY_JSON, 'utf-8');
        const json = JSON.parse(raw);

        const insert = this.sql.prepare(`
          INSERT OR REPLACE INTO documents (collection_path, doc_id, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        const tx = this.sql.transaction(() => {
          for (const [colName, docs] of Object.entries(json)) {
            for (const [docId, docData] of Object.entries(docs as Record<string, any>)) {
              insert.run(colName, docId, JSON.stringify(docData), now, now);
            }
          }
        });

        tx();
        console.log('[SqliteDb] ✅ Đã di chuyển toàn bộ dữ liệu sang SQLite Database thành công!');
      }
    } catch (e: any) {
      console.warn('[SqliteDb] Migration notice:', e.message);
    }
  }

  getRawDoc(colPath: string, docId: string): { data: string; updated_at: string } | undefined {
    return this.sql
      .prepare('SELECT data, updated_at FROM documents WHERE collection_path = ? AND doc_id = ?')
      .get(colPath, docId) as any;
  }

  getCollectionDocs(colPath: string): Array<{ doc_id: string; data: string }> {
    return this.sql
      .prepare('SELECT doc_id, data FROM documents WHERE collection_path = ?')
      .all(colPath) as any;
  }

  saveDoc(colPath: string, docId: string, data: any) {
    const now = new Date().toISOString();
    const jsonStr = JSON.stringify(data);
    this.sql
      .prepare(`
        INSERT INTO documents (collection_path, doc_id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(collection_path, doc_id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `)
      .run(colPath, docId, jsonStr, now, now);
  }

  deleteDoc(colPath: string, docId: string) {
    this.sql
      .prepare('DELETE FROM documents WHERE collection_path = ? AND doc_id = ?')
      .run(colPath, docId);
  }

  runTransactionSync(fn: () => void) {
    const tx = this.sql.transaction(fn);
    return tx();
  }

  collection(name: string): SqliteCollectionRef {
    const normalized = name.replace(/^\/+|\/+$/g, '');
    return new SqliteCollectionRef(this, normalized);
  }

  doc(docPath: string): SqliteDocRef {
    const normalized = docPath.replace(/^\/+|\/+$/g, '');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) {
      throw new Error(`Invalid document path: ${docPath}`);
    }
    const colPath = normalized.substring(0, lastSlash);
    const docId = normalized.substring(lastSlash + 1);
    return this.collection(colPath).doc(docId);
  }

  batch(): SqliteBatch {
    return new SqliteBatch(this);
  }

  bulkWriter(): SqliteBulkWriter {
    return new SqliteBulkWriter(this);
  }

  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: any, options?: any) => docRef.set(data, options),
      update: (docRef: any, data: any) => docRef.update(data),
      delete: (docRef: any) => docRef.delete()
    };
    return await updateFunction(tx);
  }

  close() {
    this.sql.close();
  }
}

export const sqliteDb = new SqliteDb();
