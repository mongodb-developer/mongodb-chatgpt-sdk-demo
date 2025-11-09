import { randomUUID } from "node:crypto"
import { MongoClient, type Db } from "mongodb"

type MemoryDocument = Record<string, any> & { _id: string }

class MemoryCursor<T extends MemoryDocument> {
  constructor(private readonly data: T[]) {}

  sort(sortSpec: Record<string, 1 | -1>) {
    const [[field, direction]] = Object.entries(sortSpec)
    const sorted = [...this.data].sort((a, b) => {
      const aValue = a[field]
      const bValue = b[field]
      if (aValue === bValue) return 0
      if (aValue == null) return direction === 1 ? -1 : 1
      if (bValue == null) return direction === 1 ? 1 : -1
      return direction === 1 ? (aValue > bValue ? 1 : -1) : aValue > bValue ? -1 : 1
    })
    return new MemoryCursor(sorted as T[])
  }

  async toArray() {
    return [...this.data]
  }
}

class MemoryCollection<T extends MemoryDocument> {
  constructor(private readonly store: Map<string, T>) {}

  async insertOne(doc: T) {
    this.store.set(doc._id, { ...doc })
    return { insertedId: doc._id }
  }

  find(filter: Partial<T>) {
    const items = Array.from(this.store.values()).filter((item) =>
      Object.entries(filter).every(([key, value]) => item[key] === value),
    )
    return new MemoryCursor(items as T[])
  }

  async findOne(filter: Partial<T>) {
    for (const item of this.store.values()) {
      if (Object.entries(filter).every(([key, value]) => item[key] === value)) {
        return { ...item }
      }
    }
    return null
  }

  async updateOne(filter: Partial<T>, update: { $set?: Partial<T>; $setOnInsert?: Partial<T> }) {
    const existing = await this.findOne(filter)
    if (!existing) {
      return { matchedCount: 0, upsertedId: null }
    }
    const updated = {
      ...existing,
      ...(update.$set ?? {}),
    }
    this.store.set(updated._id, updated as T)
    return { matchedCount: 1, upsertedId: null }
  }

  async deleteOne(filter: Partial<T>) {
    const existing = await this.findOne(filter)
    if (!existing) {
      return { deletedCount: 0 }
    }
    this.store.delete(existing._id)
    return { deletedCount: 1 }
  }

  async bulkWrite(
    operations: Array<{
      updateOne: {
        filter: Partial<T>
        update: { $set?: Partial<T>; $setOnInsert?: Partial<T> }
        upsert?: boolean
      }
    }>,
  ) {
    for (const op of operations) {
      const { filter, update, upsert } = op.updateOne
      const existing = await this.findOne(filter)
      if (existing) {
        const updated = {
          ...existing,
          ...(update.$set ?? {}),
        }
        this.store.set(updated._id, updated as T)
      } else if (upsert) {
        const newDoc = {
          _id: (filter as { _id: string })._id ?? randomUUID(),
          ...(update.$setOnInsert ?? {}),
          ...(update.$set ?? {}),
        } as T
        this.store.set(newDoc._id, newDoc)
      }
    }
    return { matchedCount: operations.length }
  }

  aggregate(pipeline: Array<Record<string, any>>) {
    const firstStage = pipeline[0]
    if (firstStage?.$group?.["items"]?.$push && firstStage.$group._id === "$listId") {
      const grouped = new Map<string, any[]>()
      for (const item of this.store.values()) {
        const listId = item.listId
        if (!grouped.has(listId)) {
          grouped.set(listId, [])
        }
        grouped.get(listId)!.push({
          id: item._id,
          text: item.text,
          completed: item.completed,
        })
      }
      const results = Array.from(grouped.entries()).map(([listId, items]) => ({
        _id: listId,
        items,
      }))
      return {
        async toArray() {
          return results
        },
      }
    }
    return {
      async toArray() {
        return []
      },
    }
  }
}

class MemoryDb {
  private readonly collections: Record<string, MemoryCollection<MemoryDocument>>

  constructor() {
    this.collections = {
      todo_lists: new MemoryCollection(new Map()),
      todo_items: new MemoryCollection(new Map()),
    }
  }

  collection(name: string) {
    if (!this.collections[name]) {
      this.collections[name] = new MemoryCollection(new Map())
    }
    return this.collections[name]
  }
}

const useMemoryStore = !process.env.MONGODB_URI

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017"

const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
}

let client: MongoClient
let clientPromise: Promise<MongoClient> | null = null
let memoryDb: MemoryDb | null = null
const getMemoryDb = () => {
  if (!memoryDb) {
    memoryDb = new MemoryDb()
  }
  return memoryDb
}

if (!useMemoryStore) {
  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect()
    }
    clientPromise = globalWithMongo._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
} else {
  memoryDb = new MemoryDb()
}

export async function getDatabase(): Promise<Db | MemoryDb> {
  if (useMemoryStore) {
    return getMemoryDb()
  }

  if (!clientPromise) {
    return getMemoryDb()
  }

  try {
    const client = await clientPromise
    return client.db("chatgpt_todos")
  } catch (error) {
    console.error("Failed to connect to MongoDB, falling back to in-memory store", error)
    return getMemoryDb()
  }
}

export async function connectToDatabase() {
  const db = await getDatabase()
  return { db }
}

export default clientPromise