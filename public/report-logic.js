async function renderRevenueTrendChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) {
        console.error("❌ ERROR: HTML canvas 'revenueChart' not found!");
        return;
    }
    console.log("📊 Attempting to render Revenue Chart...");
    
    try {
        const res = await fetch('/api/reports/weekly-trend');
        const data = await res.json();
        console.log("📈 Trend Data received from server:", data);
        
        if (data.length === 0) {
            console.warn("⚠️ Trend Data is empty. Check SQL query.");
        }
        
        // ... rest of your code ...
    } catch (e) {
        console.error("❌ Chart Fetch Error:", e);
    }
}




console.log("🚀 Report Logic File Loaded Successfully!");

/**
 * CORE AUDIT LOGIC: Historical Transaction Statement
 */
async function loadStatement() {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    const tbody = document.getElementById('statement-body');

    if (!tbody || !startInput || !endInput) return;

    const start = startInput.value;
    const end = endInput.value;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">🔍 Auditing Records...</td></tr>';

    try {
        const url = `/api/reports/statement?start=${start}&end=${end}`;
        console.log("Fetching from:", url);

        const res = await fetch(url);
        const data = await res.json();

        console.log("SERVER DATA RECEIVED:", data);

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No records found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(row => {
            // MATCHING THE SQL NAMES FROM YOUR SERVER.JS
            const targetAmt = parseFloat(row.owner_target) || 0;
            const actualAmt = parseFloat(row.actual_collections) || 0;
            const fuelAmt   = parseFloat(row.fuel_cost) || 0;

            const allowance = actualAmt - targetAmt;
            const debt = fuelAmt - allowance;
            const isDebt = allowance < fuelAmt;

            return `
                <tr>
                    <td>${new Date(row.date).toLocaleDateString('en-GB')}</td>
                    <td><strong>${row.reg_prefix} ${row.reg_number}</strong></td>
                    <td>${row.staff_member || 'Unknown'}</td>
                    <td>KES ${targetAmt.toLocaleString()}</td>
                    <td>KES ${actualAmt.toLocaleString()}</td>
                    <td>KES ${fuelAmt.toLocaleString()}</td>
                    <td style="font-weight:bold; color: ${isDebt ? '#ef4444' : '#10b981'};">
                        ${isDebt ? `⚠️ DEBT: KES ${debt.toLocaleString()}` : '✅ STATUS GOOD'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Statement Load Error:", err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Connection Error. Check Server.</td></tr>';
    }
}

// Attach to window so button onclick="loadStatement()" works
window.handleGenerateClick = loadStatement;

/**
 * INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Identity & Dates
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) welcomeMsg.innerText = `Welcome, ${savedName}`;

    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-GB', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // Set Default Input Dates
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    if (startInput && endInput) {
        startInput.value = today;
        endInput.value = today;
    }

    // 2. Run Initial Fetches
    loadDailyVehicleCards();
    // Only call charts if they are defined below
    if (typeof renderRevenueTrendChart === "function") renderRevenueTrendChart();
    if (typeof renderStaffEfficiencyChart === "function") renderStaffEfficiencyChart();
    
    loadStatement(); // Load the table automatically
});

/**
 * FETCH: Dashboard Cards
 */
async function loadDailyVehicleCards() {
    const grid = document.getElementById('vehicle-reports-grid');
    if (!grid) return;

    try {
        const res = await fetch('/api/reports/daily');
        const data = await res.json();
        let totalRev = 0, totalFuel = 0;

        if (data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No activity today.</p>';
            return;
        }

grid.innerHTML = data.map(v => {
    const rev = parseFloat(v.total_collections || 0);
    const fuel = parseFloat(v.fuel_cost || 0);
    
    // CHANGE THIS: Ensure this matches the SQL alias from your server.js
    const target = parseFloat(v.owner_target|| 0); 
    
    totalRev += rev; 
    totalFuel += fuel;


            const isTargetMet = rev >= target;
            return `
                <div class="performance-card ${rev > 0 ? (isTargetMet ? 'border-green' : 'border-red') : ''}">
                    <div style="display: flex; justify-content: space-between;">
                        <div><h3>${v.reg_prefix} ${v.reg_number}</h3><small>${v.route_name || 'Route'}</small></div>
                        <span class="status-badge ${rev > 0 ? 'bg-success' : 'bg-pending'}">${rev > 0 ? 'ACTIVE' : 'IDLE'}</span>
                    </div>
                    <div class="footer-metrics" style="margin-top:15px; display:flex; justify-content:space-between;">
                        <span>KES ${rev.toLocaleString()}</span>
<span>👤 ${v.staff_member || v.submitted_by_name || 'Active Driver'}</span>
                    </div>
                </div>`;
        }).join('');

        const revEl = document.getElementById('total-revenue');
        const fuelEl = document.getElementById('total-fuel');
        if (revEl) revEl.innerText = `KES ${totalRev.toLocaleString()}`;
        if (fuelEl) fuelEl.innerText = `KES ${totalFuel.toLocaleString()}`;
    } catch (err) { console.error(err); }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html'; 
}
/**
 * FETCH: 7-Day Revenue Trend Chart
 */
async function renderRevenueTrendChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    try {
        const res = await fetch('/api/reports/weekly-trend');
        const data = await res.json();

        const labels = data.map(d => d.formatted_date);
        const revenues = data.map(d => parseFloat(d.daily_total) || 0);
        const fuels = data.map(d => parseFloat(d.fuel_total) || 0);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenues,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Fuel Cost',
                        data: fuels,
                        borderColor: '#ef4444',
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    } catch (err) { console.error("Trend Chart Error:", err); }
}

/**
 * FETCH: Staff Efficiency Charts
 */
async function renderStaffEfficiencyChart() {
    const barCtx = document.getElementById('staffChart');
    const pieCtx = document.getElementById('contributionChart');
    if (!barCtx || !pieCtx) return;

    try {
        const res = await fetch('/api/reports/staff-performance');
        const data = await res.json();

        const names = data.map(d => d.full_name);
        const income = data.map(d => parseFloat(d.total_income) || 0);
        const fuel = data.map(d => parseFloat(d.total_fuel) || 0);

        // Bar Chart
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: names,
                datasets: [
                    { label: 'Income', data: income, backgroundColor: '#10b981' },
                    { label: 'Fuel', data: fuel, backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // Pie/Doughnut Chart
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: names,
                datasets: [{
                    data: income,
                    backgroundColor: ['#1e293b', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

    } catch (err) { console.error("Staff Chart Error:", err); }
}