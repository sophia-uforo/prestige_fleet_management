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
    // Start a transaction so if one insert fails, they both fail
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const { name, email, password, role } = req.body;

        // 1. Create the Login User
        const userResult = await client.query(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
            [name, email, password, role]
        );
        
        const newUser = userResult.rows[0];
        let finalId = newUser.user_id;

        // 2. If the role is Staff, automatically add them to the Staff table
        if (role === 'Staff') {
            const staffResult = await client.query(
                "INSERT INTO staff (full_name, staff_type) VALUES ($1, $2) RETURNING staff_id",
                [name, 'Staff']
            );
            // Use the staff_id for the response so the portal works immediately
            finalId = staffResult.rows[0].staff_id;
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: "User and Staff profile created!",
            user: { 
                user_id: finalId, // This will be the staff_id for portal users
                full_name: name, 
                role: role 
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Reg Error:", err.message);
        res.status(500).json({ error: "Registration failed. Email may already exist." });
    } finally {
        client.release();
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // JOIN the users table with the staff table to get the correct staff_id
        const query = `
            SELECT 
                u.user_id, 
                u.full_name, 
                u.role, 
                u.password_hash,
                s.staff_id -- Get the ID from the staff table
            FROM users u
            LEFT JOIN staff s ON u.full_name = s.full_name
            WHERE u.email = $1;
        `;

        const result = await pool.query(query, [email]);

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
                // IMPORTANT: We send the staff_id if it exists, otherwise the user_id
                user_id: user.staff_id || user.user_id, 
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
            `INSERT INTO staff (full_name, staff_type, contact_number, license_details, date_joined) 
             VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING *`,
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
        
const finalDate = (date && date !== "") ? date : 'CURRENT_DATE';

await pool.query(
    `INSERT INTO assignments (staff_id, vehicle_id, start_date) 
     VALUES ($1, $2, ${finalDate === 'CURRENT_DATE' ? 'CURRENT_DATE' : '$3'})`,
    finalDate === 'CURRENT_DATE' ? [staff_id, vehicle_id] : [staff_id, vehicle_id, finalDate]
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


// NEW: General Edit Route (For name, role, phone, license)
app.put('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, role, phone, license } = req.body;

    try {
        await pool.query(
            `UPDATE staff 
             SET full_name = $1, staff_type = $2, contact_number = $3, license_details = $4 
             WHERE staff_id = $5`,
            [full_name, role, phone, license, id]
        );

        res.json({ message: "Staff details updated successfully!" });
    } catch (err) {
        console.error("Update Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// This route provides the data for the Staff Portal
app.get('/api/staff/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                s.staff_id, 
                s.full_name, 
                s.staff_type AS role, 
                v.vehicle_id, 
                v.reg_prefix, 
                v.reg_number
            FROM staff s
            LEFT JOIN vehicles v ON s.assigned_vehicle_id = v.vehicle_id
            WHERE s.staff_id = $1;
        `;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Staff member not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Profile API Error:", err.message);
        res.status(500).json({ error: "Server error fetching profile" });
    }
});

// --- DAILY LOGS (The "Partner Lock" Logic) ---
app.get('/api/daily-logs/status/:vehicleId', async (req, res) => {
    const { vehicleId } = req.params;
    try {
        const result = await pool.query(
            "SELECT 1 FROM daily_logs WHERE vehicle_id = $1 AND log_date = CURRENT_DATE",
            [vehicleId]
        );
        // Returns true if a row exists for today
        res.json({ alreadySubmitted: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: "Status check failed" });
    }
});

app.post("/api/daily-logs", async (req, res) => {
    try {
        const { staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections } = req.body;

        // 1. Validate that we aren't creating a duplicate for TODAY
        // Use 'log_date' to match your schema
        const checkLog = await pool.query(
            "SELECT 1 FROM daily_logs WHERE vehicle_id = $1 AND log_date = CURRENT_DATE",
            [vehicle_id]
        );

        if (checkLog.rows.length > 0) {
            return res.status(400).json({ message: "Today's log already exists for this car." });
        }

        // 2. Insert the new log
      
        const newLog = await pool.query(
            `INSERT INTO daily_logs 
            (staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections, log_date) 
            VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) 
            RETURNING *`,
            [staff_id, vehicle_id, fuel_litres, fuel_cost, total_collections]
        );
        
        res.json({ 
            message: "Log saved successfully", 
            log: newLog.rows[0] 
        });

    } catch (err) {
        console.error("Log Error:", err.message);
        // Specifically check for Foreign Key violations (e.g. invalid staff_id)
        res.status(500).json({ error: "Database error: " + err.message });
    }
});


// --- MAINTENANCE LOGS ---


// DELETE: Remove a maintenance record (Manager only check can be added here)
// GET: Fetch logs with role-based filtering
app.get('/api/maintenance', async (req, res) => {
    const userRole = req.headers['user-role'];
    const userId = req.headers['user-id'];

    try {
        let query;
        let params = [];

        // Match your \d output: id, service_date, garage_name
        const selectFields = `
            ml.id, 
            ml.service_type, 
            ml.garage_name, 
            ml.service_date, 
            ml.details, 
            ml.cost, 
            v.reg_prefix, 
            v.reg_number
        `;

        if (userRole && userRole.toLowerCase() === 'manager') {
            query = `
                SELECT ${selectFields} 
                FROM maintenance_logs ml 
                JOIN vehicles v ON ml.vehicle_id = v.vehicle_id 
                ORDER BY ml.service_date DESC`;
        } else {
            query = `
                SELECT ${selectFields} 
                FROM maintenance_logs ml 
                JOIN vehicles v ON ml.vehicle_id = v.vehicle_id 
                JOIN staff s ON v.vehicle_id = s.assigned_vehicle_id 
                WHERE s.staff_id = $1 
                ORDER BY ml.service_date DESC`;
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("DATABASE ERROR:", err.message);
        res.status(500).send("Database Error: " + err.message);
    }
});
   

// POST: Save a new maintenance log
app.post('/api/maintenance', async (req, res) => {
    // 1. Destructure the data coming from the frontend
    const { vehicle_id, service_type, garage_name, service_date, details, cost } = req.body;
    const reported_by = req.body.reported_by || 'Staff'; 

    try {
        // 2. The SQL query columns must match pgAdmin EXACTLY
        const query = `
    INSERT INTO maintenance_logs 
    (vehicle_id, service_type, garage_name, service_date, details, reported_by, cost) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    RETURNING *`;
        // 3. The values array must match the order above ($1 to $7)
        const values = [vehicle_id, service_type, garage_name, service_date, details, reported_by, cost];
        
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        // This prints the real error to your VS Code terminal
        console.error("MAINTENANCE POST ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Use maintenance_id
app.delete('/api/maintenance/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM maintenance_logs WHERE id = $1', 
            [id]
        );
        res.json({ message: "Record deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/daily', async (req, res) => {
    try {
        const query = `
            SELECT 
                v.vehicle_id, 
                v.reg_prefix, 
                v.reg_number, 
                v.route_name, 
                v.daily_target AS owner_target,
                COALESCE(dl.total_collections, 0) AS total_collections,
                COALESCE(dl.fuel_cost, 0) AS fuel_cost,
                COALESCE(dl.submitted_by_name, 'No Submission') AS submitted_by
            FROM vehicles v
            LEFT JOIN daily_logs dl ON v.vehicle_id = dl.vehicle_id 
                AND dl.log_date = CURRENT_DATE
            ORDER BY v.reg_number ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Reports API Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});


// Route to save daily revenue and fuel logs
app.post("/api/daily-logs", async (req, res) => {
    try {
        // ADDED: staff_name from the request body
     const { vehicle_id, staff_id, staff_name, fuel_litres, fuel_cost, total_collections } = req.body;
// Check if name is missing and provide a fallback just in case
const finalName = staff_name || "Unknown Staff";

        const checkLog = await pool.query(
            "SELECT 1 FROM daily_logs WHERE vehicle_id = $1 AND log_date = CURRENT_DATE",
            [vehicle_id]
        );

        if (checkLog.rows.length > 0) {
            return res.status(400).json({ 
                error: "Submission Blocked", 
                message: "Today's log for this vehicle has already been submitted." 
            });
        }

        // UPDATED: Now inserting submitted_by_name
        const query = `
            INSERT INTO daily_logs (vehicle_id, staff_id, submitted_by_name, fuel_litres, fuel_cost, total_collections, log_date)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
            RETURNING *;
        `;

        const values = [vehicle_id, staff_id, staff_name, fuel_litres, fuel_cost, total_collections];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error("❌ Database Error:", err.message);
        res.status(500).json({ error: "Failed to save log", details: err.message });
    }
});

// Inside server.js
app.get('/api/reports/weekly-trend', async (req, res) => {
    try {
        const query = `
            SELECT 
                TO_CHAR(log_date, 'DD Mon') AS formatted_date,
                SUM(total_collections) AS daily_total,
                SUM(fuel_cost) AS fuel_total
            FROM daily_logs
            WHERE log_date > CURRENT_DATE - INTERVAL '7 days'
            GROUP BY log_date
            ORDER BY log_date ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json(err); }
});

app.get("/api/reports/staff-performance", async (req, res) => {
    try {
        const query = `
            SELECT 
                -- Priority: The name typed during submission, fallback to the staff table
                COALESCE(dl.submitted_by_name, s.full_name) AS full_name,
                SUM(dl.total_collections) as total_income,
                SUM(dl.fuel_cost) as total_fuel,
                COUNT(*) as trips_completed
            FROM daily_logs dl
            LEFT JOIN staff s ON dl.staff_id = s.staff_id
            WHERE dl.log_date = CURRENT_DATE
            GROUP BY COALESCE(dl.submitted_by_name, s.full_name)
            ORDER BY total_income DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Performance Report Error:", err.message);
        res.status(500).send("Server Error");
    }
});

// server.js - Statement Route
// server.js - Updated Statement Route
app.get('/api/reports/statement', async (req, res) => {
    const { start, end } = req.query;
    try {
        const query = `
            SELECT 
                dl.log_date AS date, 
                v.reg_prefix, 
                v.reg_number, 
                v.daily_target AS owner_target, -- Pulling live from vehicles table
                COALESCE(s.full_name, dl.submitted_by_name, 'Unknown Staff') AS staff_member,
                COALESCE(dl.total_collections, 0) AS actual_collections,
                COALESCE(dl.fuel_cost, 0) AS fuel_cost
            FROM daily_logs dl
            INNER JOIN vehicles v ON dl.vehicle_id = v.vehicle_id 
            LEFT JOIN staff s ON dl.staff_id = s.staff_id
            WHERE dl.log_date BETWEEN $1 AND $2
            ORDER BY dl.log_date DESC;
        `;
        const result = await pool.query(query, [start, end]);
        res.json(result.rows);
    } catch (err) {
        console.error("Statement API Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

// --- server.js ---
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COALESCE(SUM(total_collections)::FLOAT, 0) AS total_revenue,
                COALESCE(SUM(fuel_cost)::FLOAT, 0) AS total_fuel,
                (SELECT COUNT(*) FROM vehicles) AS total_vehicles,
                (SELECT COUNT(DISTINCT vehicle_id) FROM daily_logs WHERE log_date = CURRENT_DATE) AS active_today
            FROM daily_logs
            WHERE log_date = CURRENT_DATE;
        `;
        const result = await pool.query(statsQuery);
        
        // This MUST be the last line in the route
        res.json(result.rows[0]); 
    } catch (err) {
        console.error("Dashboard Stats Error:", err.message);
        res.status(500).json({ error: "Could not load stats" });
    }
});

app.post('/api/auth/register-staff', async (req, res) => {
    const { fullName, password } = req.body;

    try {
        // 1. Single Query to check existence, vehicle assignment, and current password status
        const staffData = await pool.query(`
            SELECT s.staff_id, s.password, s.assigned_vehicle_id, v.reg_number 
            FROM staff s
            LEFT JOIN vehicles v ON s.assigned_vehicle_id = v.vehicle_id
            WHERE s.full_name = $1`, 
            [fullName]
        );

        // CHECK A: Does the name even exist?
        if (staffData.rows.length === 0) {
            return res.status(400).json({ 
                message: "Registration failed: Name not found in Manager's records." 
            });
        }

        const user = staffData.rows[0];

        // CHECK B: Are they already registered?
        if (user.password) {
            return res.status(400).json({ message: "This account is already registered." });
        }

        // CHECK C: Is there a vehicle assigned? (Forensic requirement)
        if (!user.assigned_vehicle_id) {
            return res.status(400).json({ 
                message: "No assigned vehicle found. Please ask the manager to assign you a vehicle before registering." 
            });
        }

        // 2. Success! Update the record with the password
        // Reminder: For your final project, wrap this password in bcrypt.hash()!
        await pool.query(
            "UPDATE staff SET password = $1 WHERE full_name = $2",
            [password, fullName]
        );

        console.log(`✅ Registration successful for: ${fullName} (Vehicle: ${user.reg_number})`);
        
        res.json({ 
            message: "Registration successful!", 
            vehicle: user.reg_number 
        });

    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).json({ error: "Server error during registration." });
    }
});


app.use(express.static('public'));

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 PFMS Server running on port ${PORT}`);
});