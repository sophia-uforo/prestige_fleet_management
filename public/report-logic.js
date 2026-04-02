document.addEventListener('DOMContentLoaded', async () => {

    // 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    // 2. Initialize Date Display
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('en-GB', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }

    // 3. Load Dashboard Components
    loadDailyVehicleCards();
    renderRevenueTrendChart();
    renderStaffEfficiencyChart();
});

/**
 * FETCH 1: Individual Vehicle Performance Cards (Today Only)
 */
async function loadDailyVehicleCards() {
    const grid = document.getElementById('vehicle-reports-grid');
    try {
        const res = await fetch('/api/reports/daily');
        const data = await res.json();

        let totalRev = 0;
        let totalFuel = 0;

        if (data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No activity recorded today.</p>';
            return;
        }

        grid.innerHTML = data.map(v => {
            const rev = parseFloat(v.total_collections || 0);
            const fuel = parseFloat(v.fuel_cost || 0);
            const target = parseFloat(v.daily_target || 5000);
            
            totalRev += rev;
            totalFuel += fuel;

            const perfPercent = Math.min((rev / target) * 100, 100);
            const isTargetMet = rev >= target;

            return `
                <div class="performance-card ${rev > 0 ? (isTargetMet ? 'border-green' : 'border-red') : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin:0">${v.reg_prefix} ${v.reg_number}</h3>
                            <small class="text-muted">${v.route_name || 'Generic Route'}</small>
                        </div>
                        <span class="status-badge ${rev > 0 ? 'bg-success' : 'bg-pending'}">${rev > 0 ? 'ACTIVE' : 'IDLE'}</span>
                    </div>

                    <div class="progress-container" style="background: #e2e8f0; height: 8px; border-radius: 4px; margin: 15px 0;">
                        <div class="progress-bar" style="width: ${perfPercent}%; height: 100%; border-radius: 4px; background: ${isTargetMet ? '#10b981' : '#3b82f6'}; transition: width 0.5s;"></div>
                    </div>

                    <div class="footer-metrics" style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                        <span style="font-weight: 600;">KES ${rev.toLocaleString()}</span>
                        <span class="text-muted">👤 ${v.submitted_by || 'Unassigned'}</span>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('total-revenue').innerText = `KES ${totalRev.toLocaleString()}`;
        document.getElementById('total-fuel').innerText = `KES ${totalFuel.toLocaleString()}`;

    } catch (err) {
        console.error("Card Load Error:", err);
    }
}

/**
 * FETCH 2: Historical Transaction Statement Logic
 */
async function loadStatement() {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    const tbody = document.getElementById('statement-body');

    if (!start || !end) {
        alert("Please select both start and end dates.");
        return;
    }

    try {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Generating statement...</td></tr>';
        
        // Pass dates as query parameters to your server
        const res = await fetch(`/api/reports/statement?start=${start}&end=${end}`);
        const data = await res.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No records found for the selected period.</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(row => {
            const income = parseFloat(row.total_collections || 0);
            const fuel = parseFloat(row.fuel_cost || 0);
            const net = income - fuel;
            
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; hover: background #f8fafc;">
                    <td style="padding: 12px;">${new Date(row.log_date).toLocaleDateString('en-GB')}</td>
                    <td style="padding: 12px; font-weight: 500;">${row.reg_prefix} ${row.reg_number}</td>
                    <td style="padding: 12px;">${row.full_name}</td>
                    <td style="padding: 12px;">${income.toLocaleString()}</td>
                    <td style="padding: 12px;">${fuel.toLocaleString()}</td>
                    <td style="padding: 12px; font-weight: 700; color: ${net >= 0 ? '#10b981' : '#ef4444'}">
                        ${net.toLocaleString()}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Statement Load Error:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Error connecting to server.</td></tr>';
    }
}

/**
 * FETCH 3: 7-Day Revenue Trend Chart
 */
async function renderRevenueTrendChart() {
    try {
        const res = await fetch('/api/reports/weekly-trend');
        const data = await res.json();

        const labels = data.map(d => d.formatted_date.trim());
        const revenues = data.map(d => d.daily_total);
        const fuels = data.map(d => d.fuel_total);

        new Chart(document.getElementById('revenueChart'), {
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
 * FETCH 4: Staff Efficiency & Contribution Charts
 */
async function renderStaffEfficiencyChart() {
    try {
        const res = await fetch('/api/reports/staff-performance');
        const data = await res.json();

        const names = data.map(d => d.full_name);
        const income = data.map(d => d.total_income);
        const fuel = data.map(d => d.total_fuel);

        new Chart(document.getElementById('staffChart'), {
            type: 'bar',
            data: {
                labels: names,
                datasets: [
                    { label: 'Income', data: income, backgroundColor: '#10b981' },
                    { label: 'Fuel', data: fuel, backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });

        new Chart(document.getElementById('contributionChart'), {
            type: 'doughnut',
            data: {
                labels: names,
                datasets: [{
                    data: income,
                    backgroundColor: ['#1e293b', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });

    } catch (err) { console.error("Staff Chart Error:", err); }
}

/**
 * EXPORT: CSV Logic
 */
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    const rows = [["Date", "Reg", "Route", "Revenue", "Fuel", "Staff"]];
    const cards = document.querySelectorAll('.performance-card');
    
    cards.forEach(card => {
        const reg = card.querySelector('h3').innerText;
        const route = card.querySelector('.text-muted').innerText;
        const rev = card.querySelector('.footer-metrics span:first-child').innerText.replace('KES ', '').replace(/,/g, '');
        const staff = card.querySelector('.footer-metrics span:last-child').innerText.replace('👤 ', '');
        rows.push([new Date().toLocaleDateString(), reg, route, rev, "N/A", staff]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "Prestige_Fleet_Daily_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

function logout() {
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('token');
    window.location.href = 'index.html'; 
}