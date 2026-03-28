document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Fetch all data in parallel
        const [vehRes, staffRes, maintRes, statsRes] = await Promise.all([
            fetch('/api/vehicles'),
            fetch('/api/staff'),
            fetch('/api/maintenance', {
                headers: { 'user-role': 'manager' } 
            }),
            fetch('/api/dashboard/stats')
        ]);

        const vehicles = await vehRes.json();
        const staff = await staffRes.json();
        const maintenance = await maintRes.json();
        const stats = await statsRes.json();

        // 2. Set Basic Totals
        document.getElementById('total-vehicles').innerText = vehicles.length;
        document.getElementById('total-staff').innerText = staff.length;

        // 2.5 Set Daily Revenue & Active Count
        if (document.getElementById('today-revenue')) {
            document.getElementById('today-revenue').innerText = `KES ${parseFloat(stats.total_revenue || 0).toLocaleString()}`;
        }
        if (document.getElementById('active-today')) {
            document.getElementById('active-today').innerText = `${stats.active_today || 0} / ${vehicles.length}`;
        }

        // 3. Insurance Alerts
        const today = new Date();
        let alertsCount = 0;
        const alertHtml = vehicles.filter(v => {
            if (!v.insurance_expiry) return false;
            const expiry = new Date(v.insurance_expiry);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            return diffDays <= 30;
        }).map(v => {
            alertsCount++;
            const expiry = new Date(v.insurance_expiry);
            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
            const color = diffDays < 0 ? 'red' : 'orange';
            return `<tr><td>${v.reg_prefix} ${v.reg_number}</td><td style="color:${color}">${diffDays < 0 ? 'EXPIRED' : diffDays + ' days'}</td></tr>`;
        }).join('');

        document.getElementById('insurance-alerts').innerText = alertsCount;
        document.getElementById('insurance-preview').innerHTML = alertHtml || '<tr><td colspan="2">All Clear</td></tr>';

        // 4. Maintenance Spend & Preview
        let totalSpend = 0;
        const recentMaintHtml = maintenance.slice(0, 5).map(m => {
            totalSpend += parseFloat(m.cost || 0);
            const vehicleReg = `${m.reg_prefix || ''} ${m.reg_number || 'N/A'}`;
            return `<tr><td>${vehicleReg}</td><td>${m.service_type || 'Service'}</td><td>KES ${parseFloat(m.cost || 0).toLocaleString()}</td></tr>`;
        }).join('');

        document.getElementById('monthly-spend').innerText = `KES ${totalSpend.toLocaleString()}`;
        document.getElementById('maintenance-preview').innerHTML = recentMaintHtml || '<tr><td colspan="3">No records found</td></tr>';

    } catch (err) {
        // THIS IS THE PART THAT WAS MISSING
        console.error("Dashboard Error:", err);
        // Optional: show a message to the manager
        alert("Failed to load dashboard data. Check if the server is running.");
    }
});