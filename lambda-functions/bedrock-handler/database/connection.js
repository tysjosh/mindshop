"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = exports.checkConnection = exports.closeConnection = exports.createDatabaseConnection = exports.db = void 0;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const config_1 = require("../config");
const schema = __importStar(require("./schema"));
exports.schema = schema;
// Create the connection
const connectionString = `postgresql://${config_1.config.database.username}:${config_1.config.database.password}@${config_1.config.database.host}:${config_1.config.database.port}/${config_1.config.database.database}${config_1.config.database.ssl ? "?sslmode=require" : ""}`;
const client = (0, postgres_1.default)(connectionString, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: config_1.config.database.ssl ? "require" : false,
});
exports.db = (0, postgres_js_1.drizzle)(client, { schema });
// Factory function to create database connection
const createDatabaseConnection = async () => {
    return exports.db;
};
exports.createDatabaseConnection = createDatabaseConnection;
// Connection management
const closeConnection = async () => {
    await client.end();
};
exports.closeConnection = closeConnection;
// Health check function
const checkConnection = async () => {
    try {
        await client `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error("Database connection failed:", error);
        return false;
    }
};
exports.checkConnection = checkConnection;
