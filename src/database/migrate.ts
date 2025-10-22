import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './connection';
import postgres from 'postgres';
import { config } from '../config';

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Create a migration client
    const connectionString = `postgresql://${config.database.username}:${config.database.password}@${config.database.host}:${config.database.port}/${config.database.database}${config.database.ssl ? '?sslmode=require' : ''}`;
    const migrationClient = postgres(connectionString, { max: 1 });
    
    // Run migrations
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('Migrations completed successfully');
    
    // Close the migration client
    await migrationClient.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };