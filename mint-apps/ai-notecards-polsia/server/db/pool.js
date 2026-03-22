import pg from 'pg';
import { getPoolConfig } from './runtime.js';

const pool = new pg.Pool(getPoolConfig());

export default pool;
