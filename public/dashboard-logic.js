document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch all data in parallel
    const [vehRes, staffRes, maintRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/staff'),
        fetch('/api/maintenance')
    ]);

    const vehicles = await vehRes.json();
    const staff = await staffRes.json();
    const maintenance = await maintRes.json();

    // 2. Set Basic Totals
    document.getElementById('total-vehicles').innerText = vehicles.length;
    document.getElementById('total-staff').innerText = staff.length;

    // 3. Process Insurance Alerts
    const today = new Date();
    let alertsCount = 0;
    const alertHtml = vehicles.filter(v => {
        const expiry = new Date(v.insurance_expiry);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
            alertsCount++;
            return true;
        }
        return false;
    }).map(v => {
        const expiry = new Date(v.insurance_expiry);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        const color = diffDays < 0 ? 'red' : 'orange';
        return `<tr><td>${v.reg_prefix} ${v.reg_number}</td><td style="color:${color}">${diffDays < 0 ? 'EXPIRED' : diffDays + ' days'}</td></tr>`;
    }).join('');

    document.getElementById('insurance-alerts').innerText = alertsCount;
    document.getElementById('insurance-preview').innerHTML = alertHtml || '<tr><td colspan="2">All Clear</td></tr>';

    // 4. Calculate Maintenance Spend & Preview
    let totalSpend = 0;
    const recentMaintHtml = maintenance.slice(0, 5).map(m => {
        totalSpend += parseFloat(m.cost);
        return `<tr><td>${m.reg_no}</td><td>${m.service_type}</td><td>$${parseFloat(m.cost).toFixed(2)}</td></tr>`;
    }).join('');

    document.getElementById('monthly-spend').innerText = `$${totalSpend.toLocaleString()}`;
    document.getElementById('maintenance-preview').innerHTML = recentMaintHtml;
});