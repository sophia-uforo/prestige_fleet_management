document.addEventListener('DOMContentLoaded', async () => {

// 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    // 1. Initialize Containers
    const grid = document.getElementById('vehicle-reports-grid');
    const totalRevEl = document.getElementById('total-revenue');
    const totalFuelEl = document.getElementById('total-fuel');
    
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-GB', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    // 2. Load all Dashboard Components
    loadDailyVehicleCards();
    renderRevenueTrendChart();
    renderStaffEfficiencyChart();
});

/**
 * FETCH 1: Individual Vehicle Performance Cards
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
                        <span class="${rev > 0 ? 'bg-success' : 'bg-pending'}">${rev > 0 ? 'ACTIVE' : 'IDLE'}</span>
                    </div>

                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${perfPercent}%; background: ${isTargetMet ? '#10b981' : '#3b82f6'};"></div>
                    </div>

                    <div class="footer-metrics">
                        <span>KES ${rev.toLocaleString()}</span>
                        <span>👤 ${v.submitted_by || 'Unassigned'}</span>
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
 * FETCH 2: 7-Day Revenue Line Chart
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
 * FETCH 3: Staff Efficiency & Contribution Charts
 */
async function renderStaffEfficiencyChart() {
    try {
        const res = await fetch('/api/reports/staff-performance');
        const data = await res.json();

        const names = data.map(d => d.full_name);
        const income = data.map(d => d.total_income);
        const fuel = data.map(d => d.total_fuel);

        // Bar Chart: Income vs Fuel
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

        // Doughnut Chart: Revenue Share
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
 * EXPORT: Spreadsheet CSV Logic
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