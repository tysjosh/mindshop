"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const migrator_1 = require("drizzle-orm/postgres-js/migrator");
const connection_1 = require("./connection");
const postgres_1 = __importDefault(require("postgres"));
const config_1 = require("../config");
async function runMigrations() {
    console.log('Running database migrations...');
    try {
        // Create a migration client
        const connectionString = `postgresql://${config_1.config.database.username}:${config_1.config.database.password}@${config_1.config.database.host}:${config_1.config.database.port}/${config_1.config.database.database}${config_1.config.database.ssl ? '?sslmode=require' : ''}`;
        const migrationClient = (0, postgres_1.default)(connectionString, { max: 1 });
        // Run migrations
        await (0, migrator_1.migrate)(connection_1.db, { migrationsFolder: './drizzle' });
        console.log('Migrations completed successfully');
        // Close the migration client
        await migrationClient.end();
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations();
}
//# sourceMappingURL=migrate.js.map