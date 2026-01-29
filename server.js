// server.js - Backend API Server for Tip Pool Management System
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new sqlite3.Database('./tippool.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables
function initializeDatabase() {
  db.serialize(() => {
    // Employees table
    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        color TEXT NOT NULL,
        phone TEXT,
        teller_account TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Shifts table
    db.run(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        cash_tips REAL DEFAULT 0,
        credit_tips REAL DEFAULT 0,
        week INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date)
      )
    `);

    // Shift employees (bartenders) table
    db.run(`
      CREATE TABLE IF NOT EXISTS shift_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        hours REAL DEFAULT 0,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(shift_id, employee_id)
      )
    `);

    // Shift expos table
    db.run(`
      CREATE TABLE IF NOT EXISTS shift_expos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE(shift_id, employee_id)
      )
    `);

    console.log('Database tables initialized');
  });
}

// ==================== EMPLOYEE ROUTES ====================

// Get all employees
app.get('/api/employees', (req, res) => {
  db.all('SELECT * FROM employees ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create employee
app.post('/api/employees', (req, res) => {
  const { name, role, color, phone, teller_account } = req.body;
  
  db.run(
    'INSERT INTO employees (name, role, color, phone, teller_account) VALUES (?, ?, ?, ?, ?)',
    [name, role, color, phone || null, teller_account || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, role, color, phone, teller_account });
    }
  );
});

// Update employee
app.put('/api/employees/:id', (req, res) => {
  const { name, role, color, phone, teller_account } = req.body;
  
  db.run(
    'UPDATE employees SET name = ?, role = ?, color = ?, phone = ?, teller_account = ? WHERE id = ?',
    [name, role, color, phone || null, teller_account || null, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: req.params.id, name, role, color, phone, teller_account });
    }
  );
});

// Delete employee
app.delete('/api/employees/:id', (req, res) => {
  db.run('DELETE FROM employees WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

// ==================== SHIFT ROUTES ====================

// Get all shifts
app.get('/api/shifts', (req, res) => {
  const { week } = req.query;
  
  let query = `
    SELECT s.*, 
           GROUP_CONCAT(DISTINCT se.employee_id || ':' || se.hours) as employee_data,
           GROUP_CONCAT(DISTINCT sx.employee_id) as expo_ids
    FROM shifts s
    LEFT JOIN shift_employees se ON s.id = se.shift_id
    LEFT JOIN shift_expos sx ON s.id = sx.shift_id
  `;
  
  const params = [];
  if (week) {
    query += ' WHERE s.week = ?';
    params.push(week);
  }
  
  query += ' GROUP BY s.id ORDER BY s.date DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Transform data to match frontend format
    const shifts = rows.map(row => {
      const employeeIds = [];
      const hours = {};
      
      if (row.employee_data) {
        row.employee_data.split(',').forEach(data => {
          const [empId, hrs] = data.split(':');
          employeeIds.push(parseInt(empId));
          hours[empId] = parseFloat(hrs);
        });
      }
      
      const expoIds = row.expo_ids ? row.expo_ids.split(',').map(id => parseInt(id)) : [];
      
      return {
        id: row.id,
        date: row.date,
        cashTips: row.cash_tips,
        creditTips: row.credit_tips,
        week: row.week,
        employeeIds,
        hours,
        expoIds
      };
    });
    
    res.json(shifts);
  });
});

// Create or update shift
app.post('/api/shifts', (req, res) => {
  const { date, cashTips, creditTips, week, employeeIds, hours, expoIds } = req.body;
  
  // Check if shift exists
  db.get('SELECT id FROM shifts WHERE date = ?', [date], (err, existing) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (existing) {
      // Update existing shift
      updateShift(existing.id, { cashTips, creditTips, week, employeeIds, hours, expoIds }, res);
    } else {
      // Create new shift
      db.run(
        'INSERT INTO shifts (date, cash_tips, credit_tips, week) VALUES (?, ?, ?, ?)',
        [date, cashTips || 0, creditTips || 0, week],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          const shiftId = this.lastID;
          addShiftRelations(shiftId, employeeIds, hours, expoIds, () => {
            res.json({ id: shiftId, date, cashTips, creditTips, week, employeeIds, hours, expoIds });
          });
        }
      );
    }
  });
});

// Update shift
app.put('/api/shifts/:id', (req, res) => {
  updateShift(req.params.id, req.body, res);
});

function updateShift(shiftId, data, res) {
  const { cashTips, creditTips, week, employeeIds, hours, expoIds } = data;
  
  db.run(
    'UPDATE shifts SET cash_tips = ?, credit_tips = ?, week = ? WHERE id = ?',
    [cashTips || 0, creditTips || 0, week, shiftId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Delete existing relations
      db.run('DELETE FROM shift_employees WHERE shift_id = ?', [shiftId], (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        db.run('DELETE FROM shift_expos WHERE shift_id = ?', [shiftId], (err) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          addShiftRelations(shiftId, employeeIds, hours, expoIds, () => {
            res.json({ id: shiftId, ...data });
          });
        });
      });
    }
  );
}

function addShiftRelations(shiftId, employeeIds, hours, expoIds, callback) {
  // Add bartenders
  const employeePromises = (employeeIds || []).map(empId => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO shift_employees (shift_id, employee_id, hours) VALUES (?, ?, ?)',
        [shiftId, empId, hours?.[empId] || 0],
        (err) => err ? reject(err) : resolve()
      );
    });
  });
  
  // Add expos
  const expoPromises = (expoIds || []).map(empId => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO shift_expos (shift_id, employee_id) VALUES (?, ?)',
        [shiftId, empId],
        (err) => err ? reject(err) : resolve()
      );
    });
  });
  
  Promise.all([...employeePromises, ...expoPromises])
    .then(() => callback())
    .catch(err => console.error('Error adding relations:', err));
}

// Delete shift
app.delete('/api/shifts/:id', (req, res) => {
  db.run('DELETE FROM shifts WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: this.changes });
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tip Pool API Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
