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

// --- VEHICLE MANAGEMENT ---

// 1. GET: Fetch all vehicles
app.get('/api/vehicles', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                vehicle_id, 
                reg_prefix, 
                reg_number, 
                model, 
                route_name, 
                daily_target, 
                insurance_expiry 
            FROM vehicles 
            ORDER BY vehicle_id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Database Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to fetch vehicles" });
    }
});

// 2. POST: Create a new vehicle
app.post('/api/vehicles', async (req, res) => {
    const { reg_prefix, reg_number, model, insurance_expiry, route_name, daily_target } = req.body;
    
    try {
        const newVehicle = await pool.query(
            `INSERT INTO vehicles (reg_prefix, reg_number, model, insurance_expiry, route_name, daily_target) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                reg_prefix ? reg_prefix.toUpperCase().trim() : null, 
                reg_number ? reg_number.toUpperCase().trim() : null, 
                model, 
                insurance_expiry || null, 
                route_name, 
                daily_target || 0
            ]
        );
        res.status(201).json(newVehicle.rows[0]);
    } catch (err) {
        console.error("Insert Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. PUT: Update an existing vehicle
app.put("/api/vehicles/:id", async (req, res) => {
    const { id } = req.params;
    const { reg_prefix, reg_number, model, route_name, daily_target, insurance_expiry } = req.body;

    try {
        const result = await pool.query(
            `UPDATE vehicles 
             SET reg_prefix = $1, reg_number = $2, model = $3, 
                 route_name = $4, daily_target = $5, insurance_expiry = $6 
             WHERE vehicle_id = $7
             RETURNING *`,
            [
                reg_prefix ? reg_prefix.toUpperCase().trim() : null, 
                reg_number ? reg_number.toUpperCase().trim() : null, 
                model, 
                route_name, 
                daily_target, 
                insurance_expiry || null, 
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Vehicle not found" });
        }

        res.json({ message: "Vehicle updated successfully!", vehicle: result.rows[0] });
    } catch (err) {
        console.error("Update Error:", err.message);
        res.status(500).json({ error: "Server error during update" });
    }
});

// 4. DELETE: Remove a vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM vehicles WHERE vehicle_id = $1", [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Vehicle not found" });
        }
        res.json({ message: "Vehicle deleted" });
    } catch (err) {
        console.error("Delete Error:", err.message);
        res.status(500).json({ error: "Delete failed. Vehicle might be linked to other records." });
    }
});

// --- STAFF & ASSIGNMENTS ---

// 1. GET ALL STAFF
app.get('/api/staff', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT ON (s.staff_id)
                s.staff_id, 
                s.full_name, 
                s.staff_type AS role,
                s.contact_number AS phone,
                s.license_details AS license,
                s.created_at,                  -- Now this column exists!
                v.reg_prefix, 
                v.reg_number 
            FROM staff s
            LEFT JOIN assignments a ON s.staff_id = a.staff_id
            LEFT JOIN vehicles v ON a.vehicle_id = v.vehicle_id
            ORDER BY s.staff_id DESC, a.assignment_id DESC
        `;
        const allStaff = await pool.query(query);
        res.json(allStaff.rows);
    } catch (err) {
        console.error("GET Staff Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// 2. REGISTER NEW STAFF
app.post('/api/staff', async (req, res) => {
    const { full_name, role, phone, license } = req.body; 
    try {
        const result = await pool.query(
            `INSERT INTO staff (full_name, staff_type, contact_number, license_details) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [full_name, role, phone, license]
        );
        
        // Map it back to 'role' so the frontend doesn't break
        const savedStaff = result.rows[0];
        savedStaff.role = savedStaff.staff_type;
        
        res.status(201).json(savedStaff);
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// 3. ASSIGN STAFF TO VEHICLE
app.put('/api/staff/assign/:id', async (req, res) => {
    const staff_id = req.params.id; 
    const { vehicle_id, date } = req.body;
    try {
        const finalDate = (date && date !== "") ? date : new Date().toISOString().split('T')[0];

        // This query inserts into your assignments table
        await pool.query(
            'INSERT INTO assignments (staff_id, vehicle_id, start_date) VALUES ($1, $2, $3)',
            [staff_id, vehicle_id, finalDate]
        );
        
        // OPTIONAL: Also update the 'assigned_vehicle_id' directly in the staff table
        await pool.query(
            'UPDATE staff SET assigned_vehicle_id = $1 WHERE staff_id = $2',
            [vehicle_id, staff_id]
        );

        res.json({ message: "Assignment linked successfully!" });
    } catch (err) {
        console.error("Assignment Error:", err.message);
        res.status(500).json({ error: err.message });
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

app.get("/api/reports/daily", async (req, res) => {
    try {
        const query = `
            SELECT 
                v.reg_prefix, 
                v.reg_number, 
                v.daily_target, 
                v.route_name,
                dl.fuel_litres, 
                dl.fuel_cost, 
                dl.total_collections, 
                s.full_name AS submitted_by
            FROM vehicles v
            LEFT JOIN daily_logs dl ON v.vehicle_id = dl.vehicle_id 
                AND dl.log_date = CURRENT_DATE
            LEFT JOIN staff s ON dl.staff_id = s.staff_id -- Matches your 'fk_staff' constraint
            ORDER BY v.reg_number ASC;
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Report Error:", err.message);
        res.status(500).json({ error: "Database query failed", details: err.message });
    }
});

// Route to save daily revenue and fuel logs
app.post("/api/daily-logs", async (req, res) => {
    try {
        // Destructure the data sent from your frontend form
        const { vehicle_id, staff_id, fuel_litres, fuel_cost, total_collections } = req.body;

        // Validating that we actually received a number
        if (!total_collections || isNaN(total_collections)) {
            return res.status(400).json({ error: "Invalid revenue amount received." });
        }

        const query = `
            INSERT INTO daily_logs (vehicle_id, staff_id, fuel_litres, fuel_cost, total_collections, log_date)
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
            RETURNING *;
        `;

        const values = [vehicle_id, staff_id, fuel_litres, fuel_cost, total_collections];
        const result = await pool.query(query, values);

        console.log("✅ Log Saved Successfully:", result.rows[0]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error("❌ Database Error:", err.message);
        res.status(500).json({ error: "Failed to save log", details: err.message });
    }
});

app.get("/api/reports/weekly-trend", async (req, res) => {
    try {
        const query = `
            SELECT 
                TO_CHAR(log_date, 'Day') AS formatted_date,
                SUM(total_collections) AS daily_total,
                SUM(fuel_cost) AS fuel_total,
                log_date
            FROM daily_logs
            WHERE log_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY log_date
            ORDER BY log_date ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/api/reports/staff-performance", async (req, res) => {
    try {
        const query = `
            SELECT 
                s.full_name,
                SUM(dl.total_collections) as total_income,
                SUM(dl.fuel_cost) as total_fuel,
                COUNT(dl.id) as trips_completed
            FROM daily_logs dl
            JOIN staff s ON dl.staff_id = s.staff_id
            WHERE dl.log_date = CURRENT_DATE
            GROUP BY s.full_name
            ORDER BY total_income DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

app.use(express.static('public'));

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 PFMS Server running on port ${PORT}`);
});