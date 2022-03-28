import * as Database from 'better-sqlite3';
import * as v8 from 'v8';
import * as pathModule from 'path';
import * as fs from 'fs';

const DATABASES = pathModule.join(__dirname, '..', 'databases')

export interface DatabaseOptions {
    /** 
     * Set this to a number to tell the DB to cache an object in memory 
     * after it's been retrieved that number of times
     * */
    maxReferences?: number;
    /** Must be an absolute path */
    databaseDir?: string;
    memory?: boolean;
}

export class KSQL<K, V> {
    name: string;
    private cache = new Map<string, string>();
    private db: Database.Database;
    private referenced = new Map<string, number>();
    private statements: Record<string, Database.Statement>;
    private opts: DatabaseOptions
    constructor(name: string, opts: DatabaseOptions = {}) {
        this.name = name;
        this.opts = opts;
        const dir = opts.databaseDir || DATABASES;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.db = new Database.default(
            opts.memory ? ':memory:' : pathModule.join(dir, `${name}.db`)
        );

        try {
            this.db.exec(`SELECT * FROM ${this.name} LIMIT 1`);
        } catch {
            this.db.exec(`CREATE TABLE ${this.name} (key TEXT, value TEXT)`);
        }

        this.statements = {
            insert: this.db.prepare(`INSERT INTO ${this.name} (key, value) VALUES (?, ?)`),
            select: this.db.prepare(`SELECT * FROM ${this.name} WHERE key = ?`),
            delete: this.db.prepare(`DELETE FROM ${this.name} WHERE key = ?`),
            keys: this.db.prepare(`SELECT key FROM ${this.name} LIMIT ?`),
            values: this.db.prepare(`SELECT value FROM ${this.name} LIMIT ?`),
            entries: this.db.prepare(`SELECT key, value FROM ${this.name} LIMIT ?`),
        };
    }
    private serialize(val: any) {
        return v8.serialize(val).toString('base64');
    }
    private deserialize(val: string) {
        return v8.deserialize(Buffer.from(val, 'base64'));
    }
    get(key: K): V | null {
        const k = this.serialize(key);
        const entry = this.cache.get(k);
        if (entry) {
            return this.deserialize(entry);
        }
        const row = this.statements.select.get(k);
        if (row) {
            const value = this.deserialize(row.value);
            const maxRefs = this.opts.maxReferences;
            if (maxRefs) {
                this.referenced.set(k, (this.referenced.get(k) || 0) + 1);
                if (this.referenced.get(k)! >= maxRefs) {
                    this.cache.set(k, value);
                }
            }
            return value;
        }
        return null;
    }
    set(key: K, value: V) {
        this.statements.insert.run([key, value].map(this.serialize));
        return this;
    }
    delete(key: K) {
        const k = this.serialize(key);
        this.statements.delete.run(k);
        this.cache.delete(k);
        this.referenced.delete(k);
        return this;
    }
    keys(limit = 100) {
        return this.statements.keys
            .all(limit)
            .map(row => this.deserialize(row.key));
    }
    values(limit = 100) {
        return this.statements.values
            .all(limit)
            .map(row => this.deserialize(row.value));
    }
    entries(limit = 100) {
        return this.statements.entries
            .all(limit)
            .map(row => [row.key, row.value].map(this.deserialize));
    }
    destroy(deleteFile = false) {
        this.db.close();
        if (deleteFile) {
            fs.unlinkSync(this.db.name);
        }
    }
}