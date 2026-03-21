require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db'); 
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());


// --- DATABASE TEST ROUTE ---
app.get("/db-test", async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ message: "Database connected!", time: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database connection error");
    }
});

// --- AUTHENTICATION ROUTES ---

// 1. Register User (For Login Access)
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const newUser = await pool.query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email, password, role]
        );
        
        res.status(201).json({
            message: "User registered successfully",
            user: { user_id: newUser.rows[0].user_id, name: name, role: role }
        });
    } catch (err) {
        console.error("Reg Error:", err.message);
        res.status(500).json({ error: "Registration failed. Email may exist." });
    }
});

// 2. Login User
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        const user = result.rows[0];

        if (user.password_hash !== password) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        res.json({
            message: "Login successful",
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ error: "Server error during login" });
    }
});

// --- VEHICLE MANAGEMENT ---

app.post('/api/vehicles', async (req, res) => {
    const { reg_prefix, reg_number, model, insurance_expiry, route_name } = req.body;
    try {
        const newVehicle = await pool.query(
            "INSERT INTO vehicles (reg_prefix, reg_number, model, insurance_expiry, route_name) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [reg_prefix.toUpperCase().trim(), reg_number.trim(), model, insurance_expiry, route_name]
        );
        res.status(201).json(newVehicle.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vehicles', async (req, res) => {
    try {
        const allVehicles = await pool.query("SELECT * FROM vehicles ORDER BY insurance_expiry ASC");
        res.json(allVehicles.rows);
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM vehicles WHERE vehicle_id = $1", [id]);
        res.json({ message: "Vehicle deleted" });
    } catch (err) {
        res.status(500).send("Delete failed");
    }
});

// --- STAFF & ASSIGNMENTS ---

app.get('/api/staff', async (req, res) => {
    try {
        const allStaff = await pool.query(`
            SELECT u.user_id, u.full_name, u.role, 
                   v.reg_prefix, v.reg_number 
            FROM users u
            LEFT JOIN assignments a ON u.user_id = a.staff_id
            LEFT JOIN vehicles v ON a.vehicle_id = v.vehicle_id
            WHERE u.role != 'Manager'
            ORDER BY u.user_id DESC
        `);
        res.json(allStaff.rows);
    } catch (err) {
        res.status(500).send("Server Error");
    }
});

app.get("/api/staff/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT u.user_id, u.full_name, u.role, 
                   v.vehicle_id, v.reg_prefix, v.reg_number
            FROM users u
            LEFT JOIN assignments a ON u.user_id = a.staff_id
            LEFT JOIN vehicles v ON a.vehicle_id = v.vehicle_id
            WHERE u.user_id = $1
            ORDER BY a.assignment_id DESC LIMIT 1
        `;
        if (isNaN(id)) {
            return res.status(400).json({ error: "Invalid Staff ID" });
        }
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Staff not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/assignments", async (req, res) => {
    try {
        const { staffId, vehicleId, startDate } = req.body;
        await pool.query(
            "INSERT INTO assignments (staff_id, vehicle_id, start_date) VALUES ($1, $2, $3)",
            [staffId, vehicleId, startDate]
        );
        res.status(201).json({ message: "Assignment saved" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Assignment failed.");
    }
});

// --- DAILY LOGS (The "Partner Lock" Logic) ---

app.get("/api/daily-logs/status/:vehicleId", async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const result = await pool.query(
            "SELECT 1 FROM daily_logs WHERE vehicle_id = $1 AND created_at::date = CURRENT_DATE",
            [vehicleId]
        );
        res.json({ alreadySubmitted: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/daily-logs", async (req, res) => {
    try {
        const { staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections } = req.body;

        const checkLog = await pool.query(
            "SELECT 1 FROM daily_logs WHERE vehicle_id = $1 AND created_at::date = CURRENT_DATE",
            [vehicle_id]
        );

        if (checkLog.rows.length > 0) {
            return res.status(400).json({ message: "Today's log already exists for this car." });
        }

        await pool.query(
            "INSERT INTO daily_logs (staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections) VALUES ($1, $2, $3, $4, $5)",
            [staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections]
        );
        
        res.json({ message: "Log saved successfully" });
    } catch (err) {
        console.error("Log Error:", err.message);
        res.status(500).json({ error: "Server error saving log" });
    }
});

// --- MAINTENANCE ---

// --- MAINTENANCE LOGS ---

// . GET: Fetch all logs with Vehicle Plate numbers
app.get('/api/maintenance', async (req, res) => {
    try {
        const query = `
            SELECT m.*, CONCAT(v.reg_prefix, ' ', v.reg_number) AS reg_no 
            FROM maintenance_logs m
            JOIN vehicles v ON m.vehicle_id = v.vehicle_id
            ORDER BY m.service_date DESC`;
        
        const result = await pool.query(query);
        res.json(result.rows); 
    } catch (err) {
        console.error("Maintenance GET Error:", err.message);
        res.status(500).json({ error: "Server error fetching logs" });
    }
});

//  POST: Save a new maintenance log
app.post('/api/maintenance', async (req, res) => {
    const { vehicle_id, service_type, garage_name, service_date, details, cost } = req.body;
    const reported_by = req.body.reported_by || 'Staff'; // Fallback if missing

    try {
        const query = `
            INSERT INTO maintenance_logs 
            (vehicle_id, service_type, garage_name, service_date, details, reported_by, cost) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`;
            
        const values = [vehicle_id, service_type, garage_name, service_date, details, reported_by, cost];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Maintenance POST Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});



// DELETE: Remove a maintenance record (Manager only check can be added here)
app.delete('/api/maintenance/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // The ID here must match the primary key of your maintenance_logs table
        await pool.query("DELETE FROM maintenance_logs WHERE log_id = $1", [id]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static('public'));

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 PFMS Server running on port ${PORT}`);
});