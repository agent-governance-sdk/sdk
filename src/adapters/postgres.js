import { GovernanceAdapter } from './index.js';

/**
 * PostgreSQL adapter. Compatible with Supabase, Neon,
 * Railway, and any pg-compatible database.
 *
 * Usage with Supabase:
 *   import { createClient } from '@supabase/supabase-js';
 *   const db = createClient(url, serviceRoleKey);
 *   const adapter = new PostgresAdapter({ client: db });
 *
 * Usage with pg:
 *   import { Pool } from 'pg';
 *   const pool = new Pool({ connectionString });
 *   const adapter = new PostgresAdapter({ pool });
 *
 * Column mapping (for existing schemas):
 *   const adapter = new PostgresAdapter({
 *     client: db,
 *     columnMap: { resource_id: 'rfp_id' },
 *   });
 */
export class PostgresAdapter extends GovernanceAdapter {
  constructor({ client, pool, tableName = 'agent_audit_log',
                decisionsTable = 'governance_decisions', columnMap = {} }) {
    super();
    this.client = client;   // Supabase client
    this.pool = pool;        // pg Pool
    this.auditTable = tableName;
    this.decisionsTable = decisionsTable;
    this.columnMap = columnMap;

    if (!client && !pool) {
      throw new Error('PostgresAdapter requires either a Supabase client or pg Pool');
    }
  }

  /** Remap entry keys using columnMap before insert. */
  _mapEntry(entry) {
    if (!Object.keys(this.columnMap).length) return entry;
    const mapped = {};
    for (const [k, v] of Object.entries(entry)) {
      mapped[this.columnMap[k] || k] = v;
    }
    return mapped;
  }

  /** Resolve a logical column name to the actual DB column. */
  _col(key) {
    return this.columnMap[key] || key;
  }

  async _query(text, values) {
    if (this.pool) {
      const result = await this.pool.query(text, values);
      return result.rows;
    }
    throw new Error('For Supabase, use insertAuditEntry directly');
  }

  async insertAuditEntry(entry) {
    const mapped = this._mapEntry(entry);

    if (this.client) {
      const { data, error } = await this.client
        .from(this.auditTable)
        .insert(mapped)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    }

    const cols = Object.keys(mapped).join(', ');
    const vals = Object.values(mapped);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this._query(
      `INSERT INTO ${this.auditTable} (${cols}) VALUES (${placeholders}) RETURNING id`,
      vals
    );
    return rows[0];
  }

  async queryAuditEntries({ owner_id, resource_id, agent, limit = 50 }) {
    if (this.client) {
      let q = this.client.from(this.auditTable).select('*');
      if (owner_id) q = q.eq(this._col('owner_id'), owner_id);
      if (resource_id) q = q.eq(this._col('resource_id'), resource_id);
      if (agent) q = q.eq(this._col('agent'), agent);
      const { data, error } = await q.order('ts', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    }

    const conditions = [];
    const vals = [];
    if (owner_id) { conditions.push(`${this._col('owner_id')} = $${vals.length + 1}`); vals.push(owner_id); }
    if (resource_id) { conditions.push(`${this._col('resource_id')} = $${vals.length + 1}`); vals.push(resource_id); }
    if (agent) { conditions.push(`${this._col('agent')} = $${vals.length + 1}`); vals.push(agent); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this._query(
      `SELECT * FROM ${this.auditTable} ${where} ORDER BY ts DESC LIMIT $${vals.length + 1}`,
      [...vals, limit]
    );
  }

  async insertDecision(decision) {
    const mapped = this._mapEntry(decision);

    if (this.client) {
      const { data, error } = await this.client
        .from(this.decisionsTable)
        .insert(mapped)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    }

    const cols = Object.keys(mapped).join(', ');
    const vals = Object.values(mapped);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this._query(
      `INSERT INTO ${this.decisionsTable} (${cols}) VALUES (${placeholders}) RETURNING id`,
      vals
    );
    return rows[0];
  }

  async checkDecision({ resource_id, owner_id, required_decision }) {
    if (this.client) {
      let q = this.client
        .from(this.decisionsTable)
        .select('decision')
        .eq(this._col('resource_id'), resource_id);
      if (owner_id) q = q.eq(this._col('owner_id'), owner_id);
      const { data } = await q.maybeSingle();
      if (!data) return false;
      if (required_decision && data.decision !== required_decision) return false;
      return true;
    }

    const vals = [resource_id];
    let sql = `SELECT decision FROM ${this.decisionsTable} WHERE ${this._col('resource_id')} = $1`;
    if (owner_id) { vals.push(owner_id); sql += ` AND ${this._col('owner_id')} = $${vals.length}`; }
    const rows = await this._query(sql, vals);
    if (!rows.length) return false;
    if (required_decision && rows[0].decision !== required_decision) return false;
    return true;
  }
}
