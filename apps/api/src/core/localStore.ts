// In-memory Firestore-compatible mock store for local development without credentials
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSISTENCE_FILE = path.resolve(__dirname, '../../.local-db.json');

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

export class LocalDocRef {
  constructor(
    public id: string,
    public collectionPath: string,
    private store: Map<string, any>,
    private db: LocalDb
  ) {}

  get path(): string {
    return `${this.collectionPath}/${this.id}`;
  }

  get firestore(): LocalDb {
    return this.db;
  }

  collection(subName: string): LocalCollectionRef {
    return this.db.collection(`${this.collectionPath}/${this.id}/${subName}`);
  }

  async get() {
    const data = this.store.get(this.id);
    const unwrapElements = (obj: any): any => {
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
    };
    return {
      id: this.id,
      ref: this,
      exists: data !== undefined,
      data: () => (data ? unwrapElements(JSON.parse(JSON.stringify(data))) : undefined)
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (options?.merge && this.store.has(this.id)) {
      const existing = this.store.get(this.id) || {};
      const updated = resolveFieldValues(existing, data);
      this.store.set(this.id, updated);
    } else {
      const resolved = resolveFieldValues({}, data);
      this.store.set(this.id, resolved);
    }
    this.db.saveToDisk();
  }

  async update(data: any) {
    const existing = this.store.get(this.id) || {};
    const updated = resolveFieldValues(existing, data);
    this.store.set(this.id, updated);
    this.db.saveToDisk();
  }

  async delete() {
    this.store.delete(this.id);
    this.db.saveToDisk();
  }
}

export class LocalQuery {
  constructor(
    protected collectionStore: Map<string, any>,
    protected colRef?: LocalCollectionRef,
    protected filters: ((doc: any) => boolean)[] = [],
    protected limitCount?: number
  ) {}

  where(field: string, op: string, value: any): LocalQuery {
    const filter = (data: any) => {
      // Support dot-notated field in query e.g. 'roster.status'
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
    return new LocalQuery(this.collectionStore, this.colRef, [...this.filters, filter], this.limitCount);
  }

  orderBy(_field: string, _direction?: 'asc' | 'desc'): LocalQuery {
    return this;
  }

  limit(count: number): LocalQuery {
    return new LocalQuery(this.collectionStore, this.colRef, this.filters, count);
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
    let entries = Array.from(this.collectionStore.entries());
    for (const filter of this.filters) {
      entries = entries.filter(([_, data]) => filter(data));
    }
    if (this.limitCount !== undefined && this.limitCount > 0) {
      entries = entries.slice(0, this.limitCount);
    }
    const docs = entries.map(([id, data]) => ({
      id,
      ref: this.colRef ? this.colRef.doc(id) : undefined,
      exists: true,
      data: () => JSON.parse(JSON.stringify(data))
    }));
    return {
      size: docs.length,
      empty: docs.length === 0,
      docs
    };
  }
}

export class LocalCollectionRef extends LocalQuery {
  constructor(
    public collectionPath: string,
    collectionStore: Map<string, any>,
    private db: LocalDb
  ) {
    super(collectionStore);
    this.colRef = this;
  }

  get firestore(): LocalDb {
    return this.db;
  }

  get path(): string {
    return this.collectionPath;
  }

  doc(id?: string): LocalDocRef {
    const docId = id || 'doc_' + Math.random().toString(36).substring(2, 11);
    return new LocalDocRef(docId, this.collectionPath, this.collectionStore, this.db);
  }

  async add(data: any): Promise<LocalDocRef> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export class LocalBatch {
  private ops: (() => Promise<void>)[] = [];

  set(docRef: any, data: any, options?: any) {
    this.ops.push(async () => {
      await docRef.set(data, options);
    });
    return this;
  }

  update(docRef: any, data: any) {
    this.ops.push(async () => {
      await docRef.update(data);
    });
    return this;
  }

  delete(docRef: any) {
    this.ops.push(async () => {
      await docRef.delete();
    });
    return this;
  }

  async commit() {
    for (const op of this.ops) {
      await op();
    }
  }
}

export class LocalBulkWriter {
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

export class LocalDb {
  private collections = new Map<string, Map<string, any>>();
  private saveTimeout: any = null;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(PERSISTENCE_FILE)) {
        const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
        const json = JSON.parse(raw);
        for (const [colName, docs] of Object.entries(json)) {
          const docMap = new Map<string, any>();
          for (const [docId, docData] of Object.entries(docs as Record<string, any>)) {
            docMap.set(docId, docData);
          }
          this.collections.set(colName, docMap);
        }
      }
    } catch (e) {
      console.warn('Failed to load local DB persistence file:', e);
    }
  }

  saveToDisk() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const exportData: Record<string, Record<string, any>> = {};
        for (const [colName, docMap] of this.collections.entries()) {
          exportData[colName] = {};
          for (const [docId, docData] of docMap.entries()) {
            exportData[colName][docId] = docData;
          }
        }
        fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(exportData, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Failed to save local DB persistence file:', e);
      }
    }, 100);
  }

  collection(name: string): LocalCollectionRef {
    const normalized = name.replace(/^\/+|\/+$/g, '');
    if (!this.collections.has(normalized)) {
      this.collections.set(normalized, new Map<string, any>());
    }
    return new LocalCollectionRef(normalized, this.collections.get(normalized)!, this);
  }

  doc(docPath: string): LocalDocRef {
    const normalized = docPath.replace(/^\/+|\/+$/g, '');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) {
      throw new Error(`Invalid document path: ${docPath}`);
    }
    const colPath = normalized.substring(0, lastSlash);
    const docId = normalized.substring(lastSlash + 1);
    return this.collection(colPath).doc(docId);
  }

  batch(): LocalBatch {
    return new LocalBatch();
  }

  bulkWriter(): LocalBulkWriter {
    return new LocalBulkWriter();
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
}

export const localDb = new LocalDb();
