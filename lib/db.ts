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

if (schemaVersion < 2) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS router_health_checks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      router_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      up INTEGER NOT NULL,
      up_endpoints INTEGER NOT NULL,
      total_endpoints INTEGER NOT NULL,
      latency_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_router_health_checks_profile_time
      ON router_health_checks (profile_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_router_health_checks_router_time
      ON router_health_checks (router_id, created_at);

    CREATE TABLE IF NOT EXISTS router_health_status (
      router_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      is_up INTEGER NOT NULL,
      up_endpoints INTEGER NOT NULL DEFAULT 0,
      total_endpoints INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      since_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_router_health_status_profile
      ON router_health_status (profile_id);

    CREATE TABLE IF NOT EXISTS router_health_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      router_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      from_up INTEGER NOT NULL,
      to_up INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_router_health_events_profile_time
      ON router_health_events (profile_id, created_at);
  `)

  db.pragma('user_version = 2')
}

if (schemaVersion < 3) {
  db.pragma('foreign_keys = OFF')

  // Create services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name TEXT NOT NULL,
      endpoints TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(name, profile_id)
    )
  `)

  // Add service_id column to routers if it doesn't exist
  const routerColumns = new Set(
    (db.pragma('table_info(routers)') as Array<{ name: string }>).map(c => c.name)
  )
  if (!routerColumns.has('service_id')) {
    db.exec(`ALTER TABLE routers ADD COLUMN service_id TEXT`)
  }

  // Migrate existing routers: create a service from each router's service_url
  const existingRouters = db.prepare('SELECT * FROM routers WHERE service_id IS NULL').all() as Array<any>
  for (const router of existingRouters) {
    // Parse service_url (could be plain string or JSON array of {url, weight})
    let endpoints: string[]
    try {
      const parsed = JSON.parse(router.service_url)
      if (Array.isArray(parsed)) {
        endpoints = parsed.map((item: any) => typeof item === 'string' ? item : item.url)
      } else {
        endpoints = [router.service_url]
      }
    } catch {
      endpoints = [router.service_url]
    }

    // Create service named after router (with -service suffix if name conflict)
    const baseServiceName = router.name
    let serviceName = baseServiceName
    let counter = 1
    while (db.prepare('SELECT id FROM services WHERE name = ? AND profile_id = ?').get(serviceName, router.profile_id)) {
      counter++
      serviceName = `${baseServiceName}-${counter}`
    }

    const serviceId = randomBytes(4).toString('hex')
    db.prepare(`
      INSERT INTO services (id, name, endpoints, enabled, profile_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      serviceId,
      serviceName,
      JSON.stringify(endpoints),
      router.enabled,
      router.profile_id
    )

    // Update router to reference the service
    db.prepare('UPDATE routers SET service_id = ? WHERE id = ?').run(serviceId, router.id)
  }

  db.pragma('foreign_keys = ON')
  db.pragma('user_version = 3')
}

if (schemaVersion < 4) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_health_checks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      service_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      up INTEGER NOT NULL,
      up_endpoints INTEGER NOT NULL,
      total_endpoints INTEGER NOT NULL,
      latency_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_service_health_checks_profile_time
      ON service_health_checks (profile_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_service_health_checks_service_time
      ON service_health_checks (service_id, created_at);

    CREATE TABLE IF NOT EXISTS service_health_status (
      service_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      is_up INTEGER NOT NULL,
      up_endpoints INTEGER NOT NULL DEFAULT 0,
      total_endpoints INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      since_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_error TEXT,
      endpoint_status TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_service_health_status_profile
      ON service_health_status (profile_id);

    CREATE TABLE IF NOT EXISTS service_health_events (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      service_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      from_up INTEGER NOT NULL,
      to_up INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_service_health_events_profile_time
      ON service_health_events (profile_id, created_at);
  `)

  db.pragma('user_version = 4')
}

if (schemaVersion < 5) {
  const serviceColumns = new Set(
    (db.pragma('table_info(services)') as Array<{ name: string }>).map(c => c.name)
  )
  if (!serviceColumns.has('logo')) {
    db.exec(`ALTER TABLE services ADD COLUMN logo TEXT`)
  }

  db.pragma('user_version = 5')
}

if (schemaVersion < 6) {
  const statusColumns = new Set(
    (db.pragma('table_info(service_health_status)') as Array<{ name: string }>).map(c => c.name)
  )
  if (!statusColumns.has('endpoint_status')) {
    db.exec(`ALTER TABLE service_health_status ADD COLUMN endpoint_status TEXT`)
  }

  db.pragma('user_version = 6')
}

if (schemaVersion < 7) {
  const serviceColumns = new Set(
    (db.pragma('table_info(services)') as Array<{ name: string }>).map(c => c.name)
  )
  if (!serviceColumns.has('tag') && !serviceColumns.has('category')) {
    db.exec(`ALTER TABLE services ADD COLUMN tag TEXT`)
  }

  db.pragma('user_version = 7')
}

if (schemaVersion < 8) {
  const serviceColumns = new Set(
    (db.pragma('table_info(services)') as Array<{ name: string }>).map(c => c.name)
  )
  // If we have category but not tag, add tag column and copy data
  if (serviceColumns.has('category') && !serviceColumns.has('tag')) {
    db.exec(`
      ALTER TABLE services ADD COLUMN tag TEXT;
      UPDATE services SET tag = category;
    `)
  }

  db.pragma('user_version = 8')
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
  service_id: string | null
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

export type ServiceRow = {
  id: string
  name: string
  endpoints: string
  logo: string | null
  tag: string | null
  enabled: number
  profile_id: string
  created_at: string
  updated_at: string
}

export type CertResolverRow = {
  id: string
  name: string
  created_at: string
}

export type RouterHealthStatusRow = {
  router_id: string
  profile_id: string
  is_up: number
  up_endpoints: number
  total_endpoints: number
  consecutive_failures: number
  since_at: string
  last_checked_at: string
  last_error: string | null
}

export type RouterHealthEventRow = {
  id: string
  router_id: string
  profile_id: string
  from_up: number
  to_up: number
  message: string
  created_at: string
}

type RouterHealthUptimeRow = {
  router_id: string
  uptime_percent: number
}

export type ServiceHealthStatusRow = {
  service_id: string
  profile_id: string
  is_up: number
  up_endpoints: number
  total_endpoints: number
  consecutive_failures: number
  since_at: string
  last_checked_at: string
  last_error: string | null
  endpoint_status: string | null
}

export type EndpointStatus = {
  url: string
  up: boolean
  latencyMs: number | null
  error: string | null
}

export type ServiceHealthEventRow = {
  id: string
  service_id: string
  profile_id: string
  from_up: number
  to_up: number
  message: string
  created_at: string
}

type ServiceHealthUptimeRow = {
  service_id: string
  uptime_percent: number
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
      db.prepare('DELETE FROM router_health_checks WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM router_health_status WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM router_health_events WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM routers WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM middlewares WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM entry_points WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM domains WHERE profile_id = ?').run(id)
      db.prepare('DELETE FROM services WHERE profile_id = ?').run(id)
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
    name: string; rule: string; service_id: string; entry_points: string[];
    middlewares: string[]; priority?: number | null; enabled?: boolean
  }) =>
    db.prepare(`
      INSERT INTO routers (name, rule, service_url, service_id, entry_points, middlewares, priority, enabled, profile_id)
      VALUES (@name, @rule, '', @service_id, @entry_points, @middlewares, @priority, @enabled, @profile_id)
    `).run({
      name: data.name,
      rule: data.rule,
      service_id: data.service_id,
      entry_points: JSON.stringify(data.entry_points),
      middlewares: JSON.stringify(data.middlewares),
      priority: data.priority ?? null,
      enabled: data.enabled !== false ? 1 : 0,
      profile_id: profileId,
    }),
  update: (id: string, data: {
    name: string; rule: string; service_id: string; entry_points: string[];
    middlewares: string[]; priority?: number | null; enabled: boolean
  }) =>
    db.prepare(`
      UPDATE routers SET name=@name, rule=@rule, service_url='', service_id=@service_id,
        entry_points=@entry_points, middlewares=@middlewares, priority=@priority,
        enabled=@enabled, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id,
      name: data.name,
      rule: data.rule,
      service_id: data.service_id,
      entry_points: JSON.stringify(data.entry_points),
      middlewares: JSON.stringify(data.middlewares),
      priority: data.priority ?? null,
      enabled: data.enabled ? 1 : 0,
    }),
  delete: (id: string) => {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM router_health_checks WHERE router_id = ?').run(id)
      db.prepare('DELETE FROM router_health_status WHERE router_id = ?').run(id)
      db.prepare('DELETE FROM router_health_events WHERE router_id = ?').run(id)
      db.prepare('DELETE FROM routers WHERE id = ?').run(id)
    })
    tx()
  },
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

export const services = {
  list: (profileId: string) =>
    db.prepare('SELECT * FROM services WHERE profile_id = ? ORDER BY name').all(profileId) as ServiceRow[],
  get: (id: string) => db.prepare('SELECT * FROM services WHERE id = ?').get(id) as ServiceRow | undefined,
  create: (profileId: string, data: { name: string; endpoints: string[]; logo?: string | null; tag?: string | null }) =>
    db.prepare(`
      INSERT INTO services (name, endpoints, logo, tag, enabled, profile_id)
      VALUES (@name, @endpoints, @logo, @tag, @enabled, @profile_id)
    `).run({
      name: data.name,
      endpoints: JSON.stringify(data.endpoints),
      logo: data.logo ?? null,
      tag: data.tag ?? null,
      enabled: 1,
      profile_id: profileId,
    }),
  update: (id: string, data: { name: string; endpoints: string[]; logo?: string | null; tag?: string | null }) =>
    db.prepare(`
      UPDATE services SET name=@name, endpoints=@endpoints, logo=@logo, tag=@tag, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id,
      name: data.name,
      endpoints: JSON.stringify(data.endpoints),
      logo: data.logo ?? null,
      tag: data.tag ?? null,
    }),
  delete: (id: string) => db.prepare('DELETE FROM services WHERE id = ?').run(id),
  toggleEnabled: (id: string, enabled: boolean) =>
    db.prepare("UPDATE services SET enabled=@enabled, updated_at=datetime('now') WHERE id=@id").run({ id, enabled: enabled ? 1 : 0 }),
}

export const certResolvers = {
  list: () => db.prepare('SELECT * FROM cert_resolvers ORDER BY name').all() as CertResolverRow[],
  create: (name: string) => db.prepare('INSERT INTO cert_resolvers (name) VALUES (?)').run(name),
  delete: (id: string) => db.prepare('DELETE FROM cert_resolvers WHERE id = ?').run(id),
}

export const routerHealth = {
  recordCheck: (input: {
    profileId: string
    routerId: string
    isUp: boolean
    upEndpoints: number
    totalEndpoints: number
    latencyMs: number | null
    error: string | null
    checkedAt?: string
  }) => {
    const checkedAt = input.checkedAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19)

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO router_health_checks (router_id, profile_id, up, up_endpoints, total_endpoints, latency_ms, error, created_at)
        VALUES (@router_id, @profile_id, @up, @up_endpoints, @total_endpoints, @latency_ms, @error, @created_at)
      `).run({
        router_id: input.routerId,
        profile_id: input.profileId,
        up: input.isUp ? 1 : 0,
        up_endpoints: input.upEndpoints,
        total_endpoints: input.totalEndpoints,
        latency_ms: input.latencyMs,
        error: input.error,
        created_at: checkedAt,
      })

      const previous = db.prepare('SELECT * FROM router_health_status WHERE router_id = ?').get(input.routerId) as RouterHealthStatusRow | undefined
      const changed = previous ? previous.is_up !== (input.isUp ? 1 : 0) : false
      const consecutiveFailures = input.isUp ? 0 : (previous ? previous.consecutive_failures + 1 : 1)
      const sinceAt = changed || !previous ? checkedAt : previous.since_at

      if (changed) {
        db.prepare(`
          INSERT INTO router_health_events (router_id, profile_id, from_up, to_up, message, created_at)
          VALUES (@router_id, @profile_id, @from_up, @to_up, @message, @created_at)
        `).run({
          router_id: input.routerId,
          profile_id: input.profileId,
          from_up: previous!.is_up,
          to_up: input.isUp ? 1 : 0,
          message: input.isUp ? 'Router recovered' : 'Router is down',
          created_at: checkedAt,
        })
      }

      db.prepare(`
        INSERT INTO router_health_status (
          router_id, profile_id, is_up, up_endpoints, total_endpoints,
          consecutive_failures, since_at, last_checked_at, last_error
        ) VALUES (
          @router_id, @profile_id, @is_up, @up_endpoints, @total_endpoints,
          @consecutive_failures, @since_at, @last_checked_at, @last_error
        )
        ON CONFLICT(router_id) DO UPDATE SET
          profile_id = excluded.profile_id,
          is_up = excluded.is_up,
          up_endpoints = excluded.up_endpoints,
          total_endpoints = excluded.total_endpoints,
          consecutive_failures = excluded.consecutive_failures,
          since_at = excluded.since_at,
          last_checked_at = excluded.last_checked_at,
          last_error = excluded.last_error
      `).run({
        router_id: input.routerId,
        profile_id: input.profileId,
        is_up: input.isUp ? 1 : 0,
        up_endpoints: input.upEndpoints,
        total_endpoints: input.totalEndpoints,
        consecutive_failures: consecutiveFailures,
        since_at: sinceAt,
        last_checked_at: checkedAt,
        last_error: input.error,
      })

      db.prepare(`
        DELETE FROM router_health_checks
        WHERE profile_id = @profile_id
          AND created_at < datetime('now', '-30 days')
      `).run({ profile_id: input.profileId })
    })

    tx()
  },
  listStatus: (profileId: string) =>
    db.prepare('SELECT * FROM router_health_status WHERE profile_id = ? ORDER BY last_checked_at DESC').all(profileId) as RouterHealthStatusRow[],
  listRecentEvents: (profileId: string, limit = 20) =>
    db.prepare('SELECT * FROM router_health_events WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?').all(profileId, limit) as RouterHealthEventRow[],
  listUptimePercent: (profileId: string, hours: number) =>
    db.prepare(`
      SELECT router_id, COALESCE(ROUND(AVG(up) * 100.0, 2), 0) as uptime_percent
      FROM router_health_checks
      WHERE profile_id = ? AND created_at >= datetime('now', ?)
      GROUP BY router_id
    `).all(profileId, `-${Math.max(1, Math.floor(hours))} hours`) as RouterHealthUptimeRow[],
}

export const serviceHealth = {
  recordCheck: (input: {
    profileId: string
    serviceId: string
    isUp: boolean
    upEndpoints: number
    totalEndpoints: number
    latencyMs: number | null
    error: string | null
    endpointStatuses?: EndpointStatus[]
    checkedAt?: string
  }) => {
    const checkedAt = input.checkedAt ?? new Date().toISOString().replace('T', ' ').slice(0, 19)

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO service_health_checks (service_id, profile_id, up, up_endpoints, total_endpoints, latency_ms, error, created_at)
        VALUES (@service_id, @profile_id, @up, @up_endpoints, @total_endpoints, @latency_ms, @error, @created_at)
      `).run({
        service_id: input.serviceId,
        profile_id: input.profileId,
        up: input.isUp ? 1 : 0,
        up_endpoints: input.upEndpoints,
        total_endpoints: input.totalEndpoints,
        latency_ms: input.latencyMs,
        error: input.error,
        created_at: checkedAt,
      })

      const previous = db.prepare('SELECT * FROM service_health_status WHERE service_id = ?').get(input.serviceId) as ServiceHealthStatusRow | undefined
      const changed = previous ? previous.is_up !== (input.isUp ? 1 : 0) : false
      const consecutiveFailures = input.isUp ? 0 : (previous ? previous.consecutive_failures + 1 : 1)
      const sinceAt = changed || !previous ? checkedAt : previous.since_at

      if (changed) {
        db.prepare(`
          INSERT INTO service_health_events (service_id, profile_id, from_up, to_up, message, created_at)
          VALUES (@service_id, @profile_id, @from_up, @to_up, @message, @created_at)
        `).run({
          service_id: input.serviceId,
          profile_id: input.profileId,
          from_up: previous!.is_up,
          to_up: input.isUp ? 1 : 0,
          message: input.isUp ? 'Service recovered' : 'Service is down',
          created_at: checkedAt,
        })
      }

      db.prepare(`
        INSERT INTO service_health_status (
          service_id, profile_id, is_up, up_endpoints, total_endpoints,
          consecutive_failures, since_at, last_checked_at, last_error, endpoint_status
        ) VALUES (
          @service_id, @profile_id, @is_up, @up_endpoints, @total_endpoints,
          @consecutive_failures, @since_at, @last_checked_at, @last_error, @endpoint_status
        )
        ON CONFLICT(service_id) DO UPDATE SET
          profile_id = excluded.profile_id,
          is_up = excluded.is_up,
          up_endpoints = excluded.up_endpoints,
          total_endpoints = excluded.total_endpoints,
          consecutive_failures = excluded.consecutive_failures,
          since_at = excluded.since_at,
          last_checked_at = excluded.last_checked_at,
          last_error = excluded.last_error,
          endpoint_status = excluded.endpoint_status
      `).run({
        service_id: input.serviceId,
        profile_id: input.profileId,
        is_up: input.isUp ? 1 : 0,
        up_endpoints: input.upEndpoints,
        total_endpoints: input.totalEndpoints,
        consecutive_failures: consecutiveFailures,
        since_at: sinceAt,
        last_checked_at: checkedAt,
        last_error: input.error,
        endpoint_status: input.endpointStatuses ? JSON.stringify(input.endpointStatuses) : null,
      })

      db.prepare(`
        DELETE FROM service_health_checks
        WHERE profile_id = @profile_id
          AND created_at < datetime('now', '-30 days')
      `).run({ profile_id: input.profileId })
    })

    tx()
  },
  listStatus: (profileId: string) =>
    db.prepare('SELECT * FROM service_health_status WHERE profile_id = ? ORDER BY last_checked_at DESC').all(profileId) as ServiceHealthStatusRow[],
  listRecentEvents: (profileId: string, limit = 20) =>
    db.prepare('SELECT * FROM service_health_events WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?').all(profileId, limit) as ServiceHealthEventRow[],
  listUptimePercent: (profileId: string, hours: number) =>
    db.prepare(`
      SELECT service_id, COALESCE(ROUND(AVG(up) * 100.0, 2), 0) as uptime_percent
      FROM service_health_checks
      WHERE profile_id = ? AND created_at >= datetime('now', ?)
      GROUP BY service_id
    `).all(profileId, `-${Math.max(1, Math.floor(hours))} hours`) as ServiceHealthUptimeRow[],
}

export default db
