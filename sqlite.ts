import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("test.db");

db.exec(`
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  age INTEGER
);`);

const query = db.prepare(`INSERT INTO people (name, age) VALUES (?, ?);`);
query.run("Bob", 40);

const rows = db.prepare("SELECT id, name, age FROM people").all();
console.log("People:");
for (const row of rows) {
  console.log(row);
}

db.close();
