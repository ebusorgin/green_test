import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const {Pool} = pkg;
import dotenv from 'dotenv';

dotenv.config();

class DB {
  constructor() {
    this.config = this.getConfig();
    this.db = new Pool(this.config);

  }

  getConfig() {
    console.log("process.env.DB_USER",process.env.DB_USER);
    console.log("process.env.DB_SCHEMA",process.env.DB_SCHEMA);
    return {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      schema: process.env.DB_SCHEMA,
      port: 5432,
    };
  }

  async query(queryText, params = []) {
    try {
      const {rows} = await this.db.query(queryText, params);
      return rows;
    } catch (error) {
      console.error("Query failed:", error);
    }
  }

  async init() {
    console.log("process.env.DB_USER", process.env.DB_PASSWORD);
    await this.createTable();
    try {
    } catch (error) {
      console.error("Initial Database connection failed:", error);
    }
  }

  async createTable() {

    const client = await this.db.connect();
    console.log('Успешное подключение к базе данных');
    await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '${process.env.DB_SCHEMA}') THEN
            EXECUTE 'CREATE SCHEMA ${process.env.DB_SCHEMA}';
        END IF;
    END
    $$;
  `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${process.env.DB_SCHEMA}.users
      (
        id         SERIAL PRIMARY KEY,
        login      VARCHAR(255) NOT NULL UNIQUE,
        token      TEXT NOT NULL,
        first_name VARCHAR(100),
        last_name  VARCHAR(100),
        phone      VARCHAR(100),
        options    JSONB DEFAULT '{}'::jsonb
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${process.env.DB_SCHEMA}.instances
      (
        id         SERIAL PRIMARY KEY,
        token      BIGINT UNIQUE,
        stateInstance      VARCHAR(100),
        user_id    INTEGER REFERENCES ${process.env.DB_SCHEMA}.users (id) ON DELETE CASCADE,
        options    JSONB DEFAULT '{}'::jsonb
      );
    `);

    console.log('End createTable');
    try {
    } catch (error) {
      await this.db.query("ROLLBACK");
      throw error;
    }

    try {
    } catch (error) {
      console.error('Ошибка при инициализации таблиц', error);
    }
  }
}
export default new DB()



