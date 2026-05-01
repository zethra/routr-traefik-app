import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { randomBytes } from 'crypto'

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'routr.db'))
db.pragma('journal_mode = WAL')

// Bootstrap tables that are safe to CREATE IF NOT EXISTS (no UNIQUE constraint changes needed)
db.exec(`
  CREATE TABLE IF NOT EXISTS cert_resolvers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Seed default profile on first run
const profileName = process.env.PROFILE_NAME ?? 'default'
const profileToken = process.env.GLOBAL_TOKEN ?? randomBytes(16).toString('hex')

const existingDefaultProfile = db.prepare('SELECT id, token FROM profiles WHERE name = ?').get(profileName) as
  | { id: string; token: string }
  | undefined

if (!existingDefaultProfile) {
  db.prepare('INSERT INTO profiles (name, token) VALUES (?, ?)').run(profileName, profileToken)
} else if (process.env.GLOBAL_TOKEN && existingDefaultProfile.token !== process.env.GLOBAL_TOKEN) {
  db.prepare('UPDATE profiles SET token = ? WHERE id = ?').run(process.env.GLOBAL_TOKEN, existingDefaultProfile.id)
}

const defaultProfile = db.prepare('SELECT id FROM profiles WHERE name = ?').get(profileName) as { id: string }
const defaultProfileId = defaultProfile.id

// Schema version migration
const schemaVersion = (db.pragma('user_version') as [{ user_version: number }])[0].user_version

if (schemaVersion < 1) {
  // v1: Add profile_id to all per-profile tables, remove global UNIQUE on name
  db.pragma('foreign_keys = OFF')

  function tableColumns(table: string): Set<string> {
    return new Set((db.pragma(`table_info(${table})`) as Array<{ name: string }>).map(c => c.name))
  }

  // Check which tables already exist
  const existingTables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>).map(t => t.name)
  )

  if (existingTables.has('routers')) {
    const rc = tableColumns('routers')
    if (!rc.has('profile_id')) {
      const hasTlsR = rc.has('tls_resolver')
      const hasTlsD = rc.has('tls_domain')
      db.exec(`CREATE TABLE routers_v2 (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        name TEXT NOT NULL,
        rule TEXT NOT NULL,
        service_url TEXT NOT NULL,
        entry_points TEXT NOT NULL DEFAULT '[]',
        middlewares TEXT NOT NULL DEFAULT '[]',
        priority INTEGER,
        tls_resolver TEXT,
        tls_domain TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name, profile_id)
      )`)
      db.exec(`INSERT INTO routers_v2 (id, name, rule, service_url, entry_points, middlewares, priority,
        tls_resolver, tls_domain, enabled, profile_id, created_at, updated_at)
        SELECT id, name, rule, service_url, entry_points, middlewares, priority,
          ${hasTlsR ? 'tls_resolver' : 'NULL'},
          ${hasTlsD ? 'tls_domain' : 'NULL'},
          enabled, '${defaultProfileId}', created_at, updated_at FROM routers`)
      db.exec(`DROP TABLE routers`)
      db.exec(`ALTER TABLE routers_v2 RENAME TO routers`)
    }
  } else {
    db.exec(`CREATE TABLE IF NOT EXISTS routers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      rule TEXT NOT NULL,
      service_url TEXT NOT NULL,
      entry_points TEXT NOT NULL DEFAULT '[]',
      middlewares TEXT NOT NULL DEFAULT '[]',
      priority INTEGER,
      tls_resolver TEXT,
      tls_domain TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, profile_id)
    )`)
  }

  if (existingTables.has('middlewares')) {
    const mc = tableColumns('middlewares')
    if (!mc.has('profile_id')) {
      db.exec(`CREATE TABLE middlewares_v2 (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER NOT NULL DEFAULT 1,
        profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name, profile_id)
      )`)
      db.exec(`INSERT INTO middlewares_v2 (id, name, type, config, enabled, profile_id, created_at, updated_at)
        SELECT id, name, type, config, enabled, '${defaultProfileId}', created_at, updated_at FROM middlewares`)
      db.exec(`DROP TABLE middlewares`)
      db.exec(`ALTER TABLE middlewares_v2 RENAME TO middlewares`)
    }
  } else {
    db.exec(`CREATE TABLE IF NOT EXISTS middlewares (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, profile_id)
    )`)
  }

  if (existingTables.has('entry_points')) {
    const ec = tableColumns('entry_points')
    if (!ec.has('profile_id')) {
      const hasPort = ec.has('port')
      db.exec(`CREATE TABLE entry_points_v2 (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        name TEXT NOT NULL,
        port INTEGER,
        profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name, profile_id)
      )`)
      db.exec(`INSERT INTO entry_points_v2 (id, name, port, profile_id, created_at)
        SELECT id, name, ${hasPort ? 'port' : 'NULL'}, '${defaultProfileId}', created_at FROM entry_points`)
      db.exec(`DROP TABLE entry_points`)
      db.exec(`ALTER TABLE entry_points_v2 RENAME TO entry_points`)
    }
  } else {
    db.exec(`CREATE TABLE IF NOT EXISTS entry_points (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      port INTEGER,
      profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, profile_id)
    )`)
  }

  if (existingTables.has('domains')) {
    const dc = tableColumns('domains')
    if (!dc.has('profile_id')) {
      db.exec(`CREATE TABLE domains_v2 (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
        domain TEXT NOT NULL,
        cert_resolver TEXT NOT NULL,
        profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(domain, profile_id)
      )`)
      db.exec(`INSERT INTO domains_v2 (id, domain, cert_resolver, profile_id, created_at)
        SELECT id, domain, cert_resolver, '${defaultProfileId}', created_at FROM domains`)
      db.exec(`DROP TABLE domains`)
      db.exec(`ALTER TABLE domains_v2 RENAME TO domains`)
    }
  } else {
    db.exec(`CREATE TABLE IF NOT EXISTS domains (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      domain TEXT NOT NULL,
      cert_resolver TEXT NOT NULL,
      profile_id TEXT NOT NULL DEFAULT '${defaultProfileId}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(domain, profile_id)
    )`)
  }

  db.pragma('foreign_keys = ON')
  db.pragma('user_version = 1')
} else {
  db.pragma('foreign_keys = ON')
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ProfileRow = {
  id: string
  name: string
  token: string
  created_at: string
}

export type ProfileWithStats = ProfileRow & {
  router_count: number
  middleware_count: number
  entry_point_count: number
  domain_count: number
}

export type RouterRow = {
  id: string
  name: string
  rule: string
  service_url: string
  entry_points: string
  middlewares: string
  priority: number | null
  tls_resolver: string | null
  tls_domain: string | null
  enabled: number
  profile_id: string
  created_at: string
  updated_at: string
}

export type MiddlewareRow = {
  id: string
  name: string
  type: string
  config: string
  enabled: number
  profile_id: string
  created_at: string
  updated_at: string
}

export type EntryPointRow = {
  id: string
  name: string
  port: number | null
  profile_id: string
  created_at: string
}

export type DomainRow = {
  id: string
  domain: string
  cert_resolver: string
  profile_id: string
  created_at: string
}

export type CertResolverRow = {
  id: string
  name: string
  created_at: string
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export const profiles = {
  list: () => db.prepare('SELECT * FROM profiles ORDER BY name').all() as ProfileRow[],
  listWithStats: () => db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM routers WHERE profile_id = p.id) as router_count,
      (SELECT COUNT(*) FROM middlewares WHERE profile_id = p.id) as middleware_count,
      (SELECT COUNT(*) FROM entry_points WHERE profile_id = p.id) as entry_point_count,
      (SELECT COUNT(*) FROM domains WHERE profile_id = p.id) as domain_count
    FROM profiles p ORDER BY p.name
  `).all() as ProfileWithStats[],
  get: (id: string) => db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined,
  getByName: (name: string) => db.prepare('SELECT * FROM profiles WHERE name = ?').get(name) as ProfileRow | undefined,
  create: (name: string) => {
    const token = randomBytes(16).toString('hex')
    db.prepare('INSERT INTO profiles (name, token) VALUES (?, ?)').run(name, token)
    return db.prepare('SELECT * FROM profiles WHERE name = ?').get(name) as ProfileRow
  },
  delete: (id: string) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM routers WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM middlewares WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM entry_points WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM domains WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id)
    })
    tx()
  },
  regenerateToken: (id: string) => {
    const token = randomBytes(16).toString('hex')
    db.prepare('UPDATE profiles SET token = ? WHERE id = ?').run(token, id)
    return token
  },
}

export const routers = {
  list: (profileId: string) =>
    db.prepare('SELECT * FROM routers WHERE profile_id = ? ORDER BY name').all(profileId) as RouterRow[],
  get: (id: string) => db.prepare('SELECT * FROM routers WHERE id = ?').get(id) as RouterRow | undefined,
  create: (profileId: string, data: {
    name: string; rule: string; service_url: string; entry_points: string[];
    middlewares: string[]; priority?: number | null; enabled?: boolean
  }) =>
    db.prepare(`
      INSERT INTO routers (name, rule, service_url, entry_points, middlewares, priority, enabled, profile_id)
      VALUES (@name, @rule, @service_url, @entry_points, @middlewares, @priority, @enabled, @profile_id)
    `).run({
      ...data,
      entry_points: JSON.stringify(data.entry_points),
      middlewares: JSON.stringify(data.middlewares),
      priority: data.priority ?? null,
      enabled: data.enabled !== false ? 1 : 0,
      profile_id: profileId,
    }),
  update: (id: string, data: {
    name: string; rule: string; service_url: string; entry_points: string[];
    middlewares: string[]; priority?: number | null; enabled: boolean
  }) =>
    db.prepare(`
      UPDATE routers SET name=@name, rule=@rule, service_url=@service_url,
        entry_points=@entry_points, middlewares=@middlewares, priority=@priority,
        enabled=@enabled, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id, ...data,
      entry_points: JSON.stringify(data.entry_points),
      middlewares: JSON.stringify(data.middlewares),
      priority: data.priority ?? null,
      enabled: data.enabled ? 1 : 0,
    }),
  delete: (id: string) => db.prepare('DELETE FROM routers WHERE id = ?').run(id),
  toggleEnabled: (id: string, enabled: boolean) =>
    db.prepare("UPDATE routers SET enabled=@enabled, updated_at=datetime('now') WHERE id=@id").run({ id, enabled: enabled ? 1 : 0 }),
}

export const middlewares = {
  list: (profileId: string) =>
    db.prepare('SELECT * FROM middlewares WHERE profile_id = ? ORDER BY name').all(profileId) as MiddlewareRow[],
  get: (id: string) => db.prepare('SELECT * FROM middlewares WHERE id = ?').get(id) as MiddlewareRow | undefined,
  create: (profileId: string, data: { name: string; type: string; config: Record<string, unknown>; enabled?: boolean }) =>
    db.prepare(`
      INSERT INTO middlewares (name, type, config, enabled, profile_id)
      VALUES (@name, @type, @config, @enabled, @profile_id)
    `).run({ ...data, config: JSON.stringify(data.config), enabled: data.enabled !== false ? 1 : 0, profile_id: profileId }),
  update: (id: string, data: { name: string; type: string; config: Record<string, unknown>; enabled: boolean }) =>
    db.prepare(`
      UPDATE middlewares SET name=@name, type=@type, config=@config, enabled=@enabled, updated_at=datetime('now')
      WHERE id=@id
    `).run({ id, ...data, config: JSON.stringify(data.config), enabled: data.enabled ? 1 : 0 }),
  delete: (id: string) => db.prepare('DELETE FROM middlewares WHERE id = ?').run(id),
  toggleEnabled: (id: string, enabled: boolean) =>
    db.prepare("UPDATE middlewares SET enabled=@enabled, updated_at=datetime('now') WHERE id=@id").run({ id, enabled: enabled ? 1 : 0 }),
}

export const entryPoints = {
  list: (profileId: string) =>
    db.prepare('SELECT * FROM entry_points WHERE profile_id = ? ORDER BY name').all(profileId) as EntryPointRow[],
  get: (id: string) => db.prepare('SELECT * FROM entry_points WHERE id = ?').get(id) as EntryPointRow | undefined,
  create: (profileId: string, name: string, port?: number | null) =>
    db.prepare('INSERT INTO entry_points (name, port, profile_id) VALUES (@name, @port, @profile_id)').run({ name, port: port ?? null, profile_id: profileId }),
  delete: (id: string) => db.prepare('DELETE FROM entry_points WHERE id = ?').run(id),
}

export const domains = {
  list: (profileId: string) =>
    db.prepare('SELECT * FROM domains WHERE profile_id = ? ORDER BY domain').all(profileId) as DomainRow[],
  create: (profileId: string, domain: string, cert_resolver: string) =>
    db.prepare('INSERT INTO domains (domain, cert_resolver, profile_id) VALUES (@domain, @cert_resolver, @profile_id)').run({ domain, cert_resolver, profile_id: profileId }),
  update: (id: string, domain: string, cert_resolver: string) =>
    db.prepare('UPDATE domains SET domain = @domain, cert_resolver = @cert_resolver WHERE id = @id').run({ id, domain, cert_resolver }),
  delete: (id: string) => db.prepare('DELETE FROM domains WHERE id = ?').run(id),
}

export const certResolvers = {
  list: () => db.prepare('SELECT * FROM cert_resolvers ORDER BY name').all() as CertResolverRow[],
  create: (name: string) => db.prepare('INSERT INTO cert_resolvers (name) VALUES (?)').run(name),
  delete: (id: string) => db.prepare('DELETE FROM cert_resolvers WHERE id = ?').run(id),
}

export default db
