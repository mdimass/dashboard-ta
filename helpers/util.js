const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.CA_CERT.replace(/\\n/g, "\n"),
  },
});

class Response {
  constructor(data, success = true) {
    this.success = success;
    this.data = data;
  }
}
module.exports = { pool, Response };
