// In-memory Firestore-compatible mock store for local development without credentials

class LocalDocRef {
  constructor(public id: string, private store: Map<string, any>) {}

  async get() {
    const data = this.store.get(this.id);
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (options?.merge && this.store.has(this.id)) {
      const existing = this.store.get(this.id) || {};
      this.store.set(this.id, { ...existing, ...data });
    } else {
      this.store.set(this.id, { ...data });
    }
  }

  async update(data: any) {
    const existing = this.store.get(this.id) || {};
    this.store.set(this.id, { ...existing, ...data });
  }

  async delete() {
    this.store.delete(this.id);
  }
}

class LocalQuery {
  constructor(private store: Map<string, any>, private filters: ((doc: any) => boolean)[] = [], private limitCount?: number) {}

  where(field: string, op: string, value: any) {
    const filter = (data: any) => {
      const val = data[field];
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
    return new LocalQuery(this.store, [...this.filters, filter], this.limitCount);
  }

  orderBy(_field: string, _direction?: 'asc' | 'desc') {
    return this;
  }

  limit(count: number) {
    return new LocalQuery(this.store, this.filters, count);
  }

  async get() {
    let entries = Array.from(this.store.entries());
    for (const filter of this.filters) {
      entries = entries.filter(([_, data]) => filter(data));
    }
    if (this.limitCount !== undefined && this.limitCount > 0) {
      entries = entries.slice(0, this.limitCount);
    }
    const docs = entries.map(([id, data]) => ({
      id,
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

class LocalCollectionRef extends LocalQuery {
  constructor(private collectionStore: Map<string, any>) {
    super(collectionStore);
  }

  doc(id?: string) {
    const docId = id || 'doc_' + Math.random().toString(36).substring(2, 11);
    return new LocalDocRef(docId, this.collectionStore);
  }
}

class LocalBatch {
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

class LocalDb {
  private collections = new Map<string, Map<string, any>>();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map<string, any>());
    }
    return new LocalCollectionRef(this.collections.get(name)!);
  }

  batch() {
    return new LocalBatch();
  }

  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    const tx = {
      get: async (docRef: any) => docRef.get(),
      set: (docRef: any, data: any) => docRef.set(data),
      update: (docRef: any, data: any) => docRef.update(data),
      delete: (docRef: any) => docRef.delete()
    };
    return await updateFunction(tx);
  }
}

export const localDb = new LocalDb();
