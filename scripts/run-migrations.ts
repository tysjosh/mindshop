#!/usr/bin/env ts-node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { config } from '../src/config';

interface Migration {
  filename: string;
  content: string;
  version: number;
}

async function runMigrations() {
  const client = new Client({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        filename TEXT NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get executed migrations
    const { rows: executedMigrations } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const executedVersions = new Set(executedMigrations.map(row => row.version));

    // Load migration files
    const migrationsDir = join(__dirname, '../src/database/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = migrationFiles.map(filename => {
      const content = readFileSync(join(migrationsDir, filename), 'utf-8');
      const version = parseInt(filename.split('_')[0], 10);
      return { filename, content, version };
    });

    // Run pending migrations
    for (const migration of migrations) {
      if (executedVersions.has(migration.version)) {
        console.log(`⏭️  Skipping migration ${migration.filename} (already executed)`);
        continue;
      }

      console.log(`🔄 Running migration ${migration.filename}...`);
      
      try {
        await client.query('BEGIN');
        
        // Execute migration
        await client.query(migration.content);
        
        // Record migration
        await client.query(
          'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
          [migration.version, migration.filename]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Migration ${migration.filename} completed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${migration.filename} failed:`, error);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}

export { runMigrations };