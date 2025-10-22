import * as schema from "./schema";
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;
export declare const createDatabaseConnection: () => Promise<import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>>;
export declare const closeConnection: () => Promise<void>;
export declare const checkConnection: () => Promise<boolean>;
export { schema };
//# sourceMappingURL=connection.d.ts.map