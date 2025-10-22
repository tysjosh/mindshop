import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

// Create the connection
const connectionString = `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}${config.database.ssl ? "?sslmode=require" : ""}`;

const client = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(client, { schema });

// Factory function to create database connection
export const createDatabaseConnection = async () => {
  try {
    // Test connection with timeout
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 5000)
      )
    ]);
    console.log('Database connected successfully');
    return db;
  } catch (error) {
    console.warn('Database connection failed, continuing without database:', error);
    return db; // Return db instance anyway for Lambda compatibility
  }
};

// Connection management
export const closeConnection = async () => {
  await client.end();
};

// Health check function
export const checkConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
};

export { schema };
