// ABOUTME: Stand-in for the supabase-js client in demo mode, backed by DemoDb.
// ABOUTME: Implements only the query, realtime, auth and functions calls the app uses.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DemoDb } from "./db";
import type { DemoFunctionRouter } from "./functions";
import type { TableName } from "./seed";

type Row = Record<string, unknown>;
type QueryResult<T> = { data: T; error: { message: string } | null };
type OrderSpec = { column: string; ascending: boolean; nullsFirst: boolean };

/** A thenable that runs `fn` only when awaited, like a supabase-js builder. */
function deferred<T>(fn: () => T): PromiseLike<T> {
  return {
    then: (onFulfilled, onRejected) => Promise.resolve().then(fn).then(onFulfilled, onRejected),
  };
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

class MockQuery implements PromiseLike<QueryResult<Row[]>> {
  private filters: ((row: Row) => boolean)[] = [];
  private orders: OrderSpec[] = [];
  private max: number | null = null;

  constructor(
    private readonly db: DemoDb,
    private readonly table: TableName,
  ) {}

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, { ascending = true, nullsFirst = false } = {}): this {
    this.orders.push({ column, ascending, nullsFirst });
    return this;
  }

  limit(count: number): this {
    this.max = count;
    return this;
  }

  maybeSingle(): PromiseLike<QueryResult<Row | null>> {
    return deferred(() => {
      const rows = this.rows();
      if (rows.length > 1)
        return { data: null, error: { message: "Query returned more than one row" } };
      return { data: rows[0] ?? null, error: null };
    });
  }

  then<A = QueryResult<Row[]>, B = never>(
    onFulfilled?: ((value: QueryResult<Row[]>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return deferred(() => ({ data: this.rows(), error: null })).then(onFulfilled, onRejected);
  }

  private rows(): Row[] {
    const rows = this.db.all(this.table).filter((row) => this.filters.every((f) => f(row)));
    // Array#sort is stable, so ties keep earlier keys' (and insertion) order.
    rows.sort((a, b) => {
      for (const { column, ascending, nullsFirst } of this.orders) {
        const aNull = a[column] == null;
        const bNull = b[column] == null;
        if (aNull && bNull) continue;
        if (aNull || bNull) return (aNull ? -1 : 1) * (nullsFirst ? 1 : -1);
        const c = compareValues(a[column], b[column]);
        if (c !== 0) return ascending ? c : -c;
      }
      return 0;
    });
    return this.max == null ? rows : rows.slice(0, this.max);
  }
}

type ChangeListener = { table: TableName; cb: (payload: unknown) => void };

class MockChannel {
  private listeners: ChangeListener[] = [];
  private unsubscribers: (() => void)[] = [];
  private subscribed = false;

  constructor(
    private readonly db: DemoDb,
    readonly topic: string,
  ) {}

  /** Only `postgres_changes` is supported; event and filter are ignored, so any write to the table fires. */
  on(type: string, filter: { table?: string }, cb: (payload: unknown) => void): this {
    if (type === "postgres_changes" && filter.table) {
      const listener = { table: filter.table as TableName, cb };
      this.listeners.push(listener);
      if (this.subscribed) this.wire(listener);
    }
    return this;
  }

  subscribe(): this {
    if (!this.subscribed) {
      this.subscribed = true;
      this.listeners.forEach((l) => this.wire(l));
    }
    return this;
  }

  unsubscribe(): Promise<"ok"> {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    this.subscribed = false;
    return Promise.resolve("ok");
  }

  private wire({ table, cb }: ChangeListener): void {
    this.unsubscribers.push(this.db.subscribe(table, () => cb({ schema: "public", table })));
  }
}

type RealClient = SupabaseClient<Database>;

export function createMockSupabase(db: DemoDb, invoke: DemoFunctionRouter): RealClient {
  const session = { user: { id: "demo" } };
  const mock = {
    from: (table: TableName) => ({
      select: (_columns?: string) => new MockQuery(db, table),
    }),
    channel: (name: string) => new MockChannel(db, name),
    removeChannel: (channel: MockChannel) => channel.unsubscribe(),
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session, user: session.user }, error: null }),
      signOut: async () => ({ error: null }),
    },
    functions: {
      invoke: async (
        name: string,
        options: { body?: Record<string, unknown>; headers?: Record<string, string> } = {},
      ) => {
        try {
          return { data: await invoke(name, options.body ?? {}, options.headers), error: null };
        } catch (e) {
          return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
        }
      },
    },
  };
  // The mock covers only the calls the app makes; the cast lets callers keep the real client's types.
  return mock as unknown as RealClient;
}
