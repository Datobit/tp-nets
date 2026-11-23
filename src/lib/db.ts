import { Pool, type QueryResult, type QueryResultRow, type PoolClient } from "pg";

export type { PoolClient };

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Brak zmiennej środowiskowej DATABASE_URL");
    }
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params as never[]);
}

/** Cała praca w jednej transakcji; rollback przy dowolnym błędzie. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignoruj błędy rollbacku
    }
    throw err;
  } finally {
    client.release();
  }
}
