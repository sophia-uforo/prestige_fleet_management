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

// 3. NEW CODE: Process P1.0 - Register Vehicle (Data Store D1)
app.post("/api/vehicles", async (req, res) => {
    try {
        const { regNo, model, routeInfo } = req.body;
        const newVehicle = await pool.query(
            "INSERT INTO VEHICLE (Reg_No, Model, Route_Info) VALUES ($1, $2, $3) RETURNING *",
            [regNo, model, routeInfo]
        );
        res.status(201).json(newVehicle.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error: Vehicle registration failed.");
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
        const { staffId, regNo, startDate, endDate } = req.body;
        
        const newAssignment = await pool.query(
            `INSERT INTO ASSIGNMENT (Staff_ID, Reg_No, Start_Date, End_Date) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [staffId, regNo, startDate, endDate || null]
        );
        
        res.status(201).json({
            message: "Assignment created successfully",
            data: newAssignment.rows[0]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error: Could not create assignment. Ensure Staff ID and Reg No are correct.");
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
 * This joins D1 (Vehicles) and D4 (Maintenance) to show total spending per vehicle.
 * Directly addresses the "Profitability" goal of the Sacco.
 */
app.get("/api/reports/maintenance-summary", async (req, res) => {
    try {
        const report = await pool.query(`
            SELECT 
                v.Reg_No, 
                v.Model, 
                COUNT(m.Log_ID) as total_visits, 
                SUM(m.Cost) as total_expenses
            FROM VEHICLE v
            LEFT JOIN MAINTENANCE_LOG m ON v.Reg_No = m.Reg_No
            GROUP BY v.Reg_No, v.Model
            ORDER BY total_expenses DESC;
        `);
        res.json(report.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Error generating report");
    }
});

// Setting the port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});