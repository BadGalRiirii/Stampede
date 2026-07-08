/**
 * Seed: offices, users, and one workflow so the app is usable immediately.
 * Run once with: npm run seed
 */
import bcrypt from "bcryptjs";
import { db, transaction } from "./db.js";

const existing = db.prepare(`SELECT COUNT(*) AS n FROM users`).get();
if (existing.n > 0) {
  console.log("Database already seeded — nothing to do.");
  process.exit(0);
}

const seed = transaction(() => {
  const office = db.prepare(`INSERT INTO offices (name, code) VALUES (?, ?)`);
  const receiving = office.run("Records & Receiving", "REC").lastInsertRowid;
  const budget = office.run("Budget Office", "BUD").lastInsertRowid;
  const accounting = office.run("Accounting", "ACC").lastInsertRowid;
  const approving = office.run("Office of the Director", "DIR").lastInsertRowid;
  const hr = office.run("Human Resources", "HR").lastInsertRowid;

  const user = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, office_id) VALUES (?, ?, ?, ?, ?)`
  );
  const hash = (p) => bcrypt.hashSync(p, 10);
  user.run("System Admin", "admin@stampede.local", hash("admin123"), "ADMIN", receiving);
  user.run("Riri", "riri@stampede.local", hash("staff123"), "STAFF", budget);
  user.run("Nics", "nics@stampede.local", hash("staff123"), "STAFF", accounting);
  user.run("Ana Reyes", "ana@stampede.local", hash("staff123"), "STAFF", approving);

  const tpl = db.prepare(`INSERT INTO workflow_templates (name, doc_type) VALUES (?, ?)`);
  const step = db.prepare(
    `INSERT INTO workflow_steps (template_id, seq, office_id, sla_hours) VALUES (?, ?, ?, ?)`
  );

  const pr = tpl.run("Purchase Request Route", "Purchase Request").lastInsertRowid;
  step.run(pr, 1, receiving, 8);
  step.run(pr, 2, budget, 24);
  step.run(pr, 3, accounting, 48);
  step.run(pr, 4, approving, 24);

  const memo = tpl.run("Memo Route", "Memo").lastInsertRowid;
  step.run(memo, 1, receiving, 8);
  step.run(memo, 2, approving, 24);

  const leave = tpl.run("Leave Application Route", "Leave Application").lastInsertRowid;
  step.run(leave, 1, receiving, 8);
  step.run(leave, 2, hr, 24);
  step.run(leave, 3, approving, 24);
});

seed();
console.log("Seeded.");
console.log("Sign in with:  admin@stampede.local / admin123  (Admin, Records & Receiving)");
console.log("Also seeded:   riri@stampede.local, nics@stampede.local, ana@stampede.local / staff123");
