import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONNECTION_FILE = join(tmpdir(), 'sideline-test-db.json');
const config = JSON.parse(readFileSync(CONNECTION_FILE, 'utf-8'));

process.env.DATABASE_HOST = config.host;
process.env.DATABASE_PORT = String(config.port);
process.env.DATABASE_NAME = config.database;
process.env.DATABASE_USER = config.username;
process.env.DATABASE_PASS = config.password;
process.env.DATABASE_MAIN = config.database;
