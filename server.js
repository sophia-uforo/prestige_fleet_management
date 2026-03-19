require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');   
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test Route
app.get('/', (req, res) => {
    res.send("PFMS Backend is Running");
});

// Fix: Completed your DB Test Route
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

// 1. Register User (P1.0 - User Management)
app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // In a real app, we'd hash the password here. 
        // For now, we store it to test the flow.
        const newUser = await pool.query(
            "INSERT INTO USERS (Full_Name, Email, Password_Hash, Role) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email, password, role]
        );
        
        res.status(201).json({
            message: "User registered successfully",
            user: { id: newUser.rows[0].user_id, name: name, role: role }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error: Could not register user. Email might already exist.");
    }
});

// 2. Login User
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await pool.query("SELECT * FROM USERS WHERE Email = $1", [email]);

        if (user.rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        // Compare plain text password
        if (user.rows[0].password_hash !== password) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        // Success! Send role back to frontend for redirection
        res.json({
            message: "Login successful",
            user: {
                name: user.rows[0].full_name,
                role: user.rows[0].role
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error during login");
    }
});
//3. vehicle regestration.
// --- VEHICLE MANAGEMENT API ---

// 1. CREATE: Register New Vehicle (P1.0)
app.post('/api/vehicles', async (req, res) => {
    const { reg_prefix, reg_number, model, insurance_expiry, route_name } = req.body;
    
    if (!reg_prefix || !reg_number) {
        return res.status(400).json({ error: "Registration prefix and number are required." });
    }

    try {
        const newVehicle = await pool.query(
            "INSERT INTO vehicles (reg_prefix, reg_number, model, insurance_expiry, route_name) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [reg_prefix.toUpperCase().trim(), reg_number.trim(), model, insurance_expiry, route_name]
        );
        res.status(201).json(newVehicle.rows[0]);
    } catch (err) {
        console.error("DB Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. READ: Fetch all vehicles (P1.1)
app.get('/api/vehicles', async (req, res) => {
    try {
        const allVehicles = await pool.query("SELECT * FROM vehicles ORDER BY insurance_expiry ASC");
        res.json(allVehicles.rows);
    } catch (err) {
        console.error("GET Error:", err.message);
        res.status(500).send("Server Error");
    }
});

// 3. DELETE: Remove vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM vehicles WHERE id = $1", [id]);
        res.json({ message: "Vehicle deleted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Delete failed");
    }
});


// 4. NEW CODE: Process P1.0 - Register Staff (Data Store D2)
app.post("/api/staff", async (req, res) => {
    try {
        const { type, name, phone, license } = req.body;
        const newStaff = await pool.query(
            "INSERT INTO STAFF (Staff_Type, Full_Name, Contact_Number, License_Details) VALUES ($1, $2, $3, $4) RETURNING *",
            [type, name, phone, license]
        );
        res.status(201).json(newStaff.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error: Staff registration failed.");
    }
});

/**
 * Process P2.0: Track Assignments (Data Store D3)
 * Links a registered staff member to a vehicle.
 * Ensures accountability by tracking who was in charge of which vehicle and when.
 */
app.post("/api/assignments", async (req, res) => {
    try {
        const { staffId, vehicleId, startDate, endDate } = req.body;
        // Notice we now use vehicle_id (integer) instead of Reg_No string
        const newAssignment = await pool.query(
            "INSERT INTO assignment (staff_id, vehicle_id, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *",
            [staffId, vehicleId, startDate, endDate || null]
        );
        res.status(201).json(newAssignment.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error: Could not create assignment.");
    }
});


/**
 * NEW CODE: Process P3.0 - Log Maintenance
 * This maps directly to Data Store D4 (MAINTENANCE_LOG) in your SDS.
 */
app.post("/api/maintenance", async (req, res) => {
    try {
        // Capturing attributes defined in your Data Model 
        const { regNo, date, description, cost, garage } = req.body;

        const newLog = await pool.query(
            `INSERT INTO MAINTENANCE_LOG (Reg_No, Date_Of_Service, Service_Description, Cost, Garage_Visited) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [regNo, date, description, cost, garage]
        );

        res.json({
            message: "Maintenance activity logged successfully",
            data: newLog.rows[0]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error: Could not log maintenance");
    }
});

/**
 * Process P4.0: Generate Performance Report
 * Updated to match the new 'vehicles' table schema.
 */
app.get("/api/reports/maintenance-summary", async (req, res) => {
    try {
        const report = await pool.query(`
            SELECT 
                v.reg_prefix, 
                v.reg_number, 
                v.model, 
                COUNT(m.log_id) as total_visits, 
                SUM(m.cost) as total_expenses
            FROM vehicles v
            LEFT JOIN maintenance_log m ON v.id = m.vehicle_id
            GROUP BY v.id, v.reg_prefix, v.reg_number, v.model
            ORDER BY total_expenses DESC;
        `);
        res.json(report.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error generating report");
    }
});

app.get('/api/staff', async (req, res) => {
    try {
        const allStaff = await pool.query(`
            SELECT 
                s.staff_id AS id,             -- Renames staff_id to id for the frontend
                s.staff_type, 
                s.full_name, 
                s.contact_number, 
                s.license_details, 
                v.reg_prefix, 
                v.reg_number 
            FROM staff s
            LEFT JOIN assignment a ON s.staff_id = a.staff_id
            LEFT JOIN vehicles v ON a.vehicle_id = v.id
            ORDER BY s.staff_id DESC
        `);
        res.json(allStaff.rows);
    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).send("Server Error");
    }
});


// DELETE: Remove a staff member

app.delete("/api/staff/:id", async (req, res) => {
    try {
        const { id } = req.params;
        // Use staff_id here because that is the real column name in the DB
        await pool.query("DELETE FROM staff WHERE staff_id = $1", [id]);
        res.json({ message: "Staff member deleted" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

app.post("/api/assignments", async (req, res) => {
    try {
        const { staffId, vehicleId, startDate } = req.body;
        await pool.query(
            "INSERT INTO assignment (staff_id, vehicle_id, start_date) VALUES ($1, $2, $3)",
            [staffId, vehicleId, startDate]
        );
        res.status(201).json({ message: "Assignment saved" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Database Error: Could not link staff to vehicle.");
    }
});

// Setting the port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});