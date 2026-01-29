// server.js - Backend API Server for Tip Pool Management System (Postgres)
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Simple health check (root-level)
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "tippool-backend" });
});

// Create tables if they don't exist
async function initializeDatabase() {
  // Employees table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      color TEXT NOT NULL,
      phone TEXT,
      teller_account TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Shifts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL UNIQUE,
      cash_tips NUMERIC(12,2) DEFAULT 0,
      credit_tips NUMERIC(12,2) DEFAULT 0,
      week INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Shift employees (bartenders) table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_employees (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      hours NUMERIC(10,2) DEFAULT 0,
      UNIQUE(shift_id, employee_id)
    )
  `);

  // Shift expos table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_expos (
      id SERIAL PRIMARY KEY,
      shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(shift_id, employee_id)
    )
  `);

  console.log("Postgres tables initialized");
}

// Call init on boot (don’t crash silently)
initializeDatabase().catch((err) => {
  console.error("Database init failed:", err);
  process.exit(1);
});

// ==================== EMPLOYEE ROUTES ====================

// Get all employees
app.get("/api/employees", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM employees ORDER BY name");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee
app.post("/api/employees", async (req, res) => {
  try {
    const { name, role, color, phone, teller_account } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO employees (name, role, color, phone, teller_account)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, role, color, phone || null, teller_account || null]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update employee
app.put("/api/employees/:id", async (req, res) => {
  try {
    const { name, role, color, phone, teller_account } = req.body;

    const { rows } = await pool.query(
      `UPDATE employees
       SET name = $1, role = $2, color = $3, phone = $4, teller_account = $5
       WHERE id = $6
       RETURNING *`,
      [name, role, color, phone || null, teller_account || null, req.params.id]
    );

    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM employees WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SHIFT ROUTES ====================

// Get all shifts (optionally by week)
app.get("/api/shifts", async (req, res) => {
  try {
    const { week } = req.query;

    // Pull shifts
    const shiftParams = [];
    let shiftSql = `
      SELECT id, date, cash_tips, credit_tips, week
      FROM shifts
    `;
    if (week) {
      shiftSql += ` WHERE week = $1`;
      shiftParams.push(week);
    }
    shiftSql += ` ORDER BY date DESC`;

    const shiftsResult = await pool.query(shiftSql, shiftParams);
    const shiftRows = shiftsResult.rows;

    if (shiftRows.length === 0) return res.json([]);

    const shiftIds = shiftRows.map((s) => s.id);

    // Pull employees per shift
    const seResult = await pool.query(
      `SELECT shift_id, employee_id, hours
       FROM shift_employees
       WHERE shift_id = ANY($1::int[])`,
      [shiftIds]
    );

    // Pull expos per shift
    const sxResult = await pool.query(
      `SELECT shift_id, employee_id
       FROM shift_expos
       WHERE shift_id = ANY($1::int[])`,
      [shiftIds]
    );

    // Build maps
    const employeesByShift = new Map();
    for (const row of seResult.rows) {
      if (!employeesByShift.has(row.shift_id)) {
        employeesByShift.set(row.shift_id, []);
      }
      employeesByShift.get(row.shift_id).push({
        employee_id: row.employee_id,
        hours: Number(row.hours || 0),
      });
    }

    const exposByShift = new Map();
    for (const row of sxResult.rows) {
      if (!exposByShift.has(row.shift_id)) exposByShift.set(row.shift_id, []);
      exposByShift.get(row.shift_id).push(row.employee_id);
    }

    // Transform to match frontend format
    const shifts = shiftRows.map((row) => {
      const employeeIds = [];
      const hours = {};

      const empRows = employeesByShift.get(row.id) || [];
      for (const e of empRows) {
        employeeIds.push(e.employee_id);
        hours[String(e.employee_id)] = e.hours;
      }

      const expoIds = exposByShift.get(row.id) || [];

      return {
        id: row.id,
        date: row.date, // will serialize as YYYY-MM-DD
        cashTips: Number(row.cash_tips || 0),
        creditTips: Number(row.credit_tips || 0),
        week: row.week,
        employeeIds,
        hours,
        expoIds,
      };
    });

    res.json(shifts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or update shift (upsert by date)
app.post("/api/shifts", async (req, res) => {
  const client = await pool.connect();
  try {
    const { date, cashTips, creditTips, week, employeeIds, hours, expoIds } =
      req.body;

    await client.query("BEGIN");

    // Upsert shift
    const upsert = await client.query(
      `
      INSERT INTO shifts (date, cash_tips, credit_tips, week)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (date)
      DO UPDATE SET cash_tips = EXCLUDED.cash_tips,
                    credit_tips = EXCLUDED.credit_tips,
                    week = EXCLUDED.week
      RETURNING id, date, cash_tips, credit_tips, week
      `,
      [date, cashTips || 0, creditTips || 0, week]
    );

    const shiftId = upsert.rows[0].id;

    // Clear existing relations
    await client.query("DELETE FROM shift_employees WHERE shift_id = $1", [
      shiftId,
    ]);
    await client.query("DELETE FROM shift_expos WHERE shift_id = $1", [shiftId]);

    // Insert employees
    for (const empId of employeeIds || []) {
      const hrs = hours?.[empId] ?? hours?.[String(empId)] ?? 0;
      await client.query(
        `INSERT INTO shift_employees (shift_id, employee_id, hours)
         VALUES ($1, $2, $3)`,
        [shiftId, empId, hrs]
      );
    }

    // Insert expos
    for (const empId of expoIds || []) {
      await client.query(
        `INSERT INTO shift_expos (shift_id, employee_id)
         VALUES ($1, $2)`,
        [shiftId, empId]
      );
    }

    await client.query("COMMIT");

    res.json({
      id: shiftId,
      date,
      cashTips: cashTips || 0,
      creditTips: creditTips || 0,
      week,
      employeeIds: employeeIds || [],
      hours: hours || {},
      expoIds: expoIds || [],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update shift by id (keeps your old endpoint working)
app.put("/api/shifts/:id", async (req, res) => {
  const shiftId = Number(req.params.id);
  const client = await pool.connect();
  try {
    const { cashTips, creditTips, week, employeeIds, hours, expoIds } = req.body;

    await client.query("BEGIN");

    await client.query(
      `UPDATE shifts SET cash_tips = $1, credit_tips = $2, week = $3 WHERE id = $4`,
      [cashTips || 0, creditTips || 0, week, shiftId]
    );

    await client.query("DELETE FROM shift_employees WHERE shift_id = $1", [
      shiftId,
    ]);
    await client.query("DELETE FROM shift_expos WHERE shift_id = $1", [shiftId]);

    for (const empId of employeeIds || []) {
      const hrs = hours?.[empId] ?? hours?.[String(empId)] ?? 0;
      await client.query(
        `INSERT INTO shift_employees (shift_id, employee_id, hours)
         VALUES ($1, $2, $3)`,
        [shiftId, empId, hrs]
      );
    }

    for (const empId of expoIds || []) {
      await client.query(
        `INSERT INTO shift_expos (shift_id, employee_id)
         VALUES ($1, $2)`,
        [shiftId, empId]
      );
    }

    await client.query("COMMIT");
    res.json({ id: shiftId, ...req.body });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete shift
app.delete("/api/shifts/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM shifts WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Tip Pool API Server is running" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
