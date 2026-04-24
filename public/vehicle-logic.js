document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    const vehicleForm = document.getElementById('vehicleForm');

    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                reg_prefix: document.getElementById('reg_prefix').value.toUpperCase(),
                reg_number: document.getElementById('reg_number').value.toUpperCase(),
                model: document.getElementById('model').value,
                insurance_expiry: document.getElementById('insurance_expiry').value,
                route_name: document.getElementById('route_name').value,
                daily_target: parseFloat(document.getElementById('daily_target').value) || 0 
            };

            const vehicleId = vehicleForm.dataset.editId;
            const url = vehicleId ? `/api/vehicles/${vehicleId}` : '/api/vehicles';
            const method = vehicleId ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert(vehicleId ? "Vehicle updated!" : "Vehicle added!");
                    vehicleForm.reset();
                    delete vehicleForm.dataset.editId; 
                    const submitBtn = vehicleForm.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.innerText = "Add Vehicle";
                    loadVehicles();
                } else {
                    const errData = await response.json();
                    alert("Error: " + (errData.error || "Action failed."));
                }
            } catch (err) {
                console.error("Connection error:", err);
            }
        });
    }

    loadVehicles();
});

async function loadVehicles() {
    const tableBody = document.getElementById('vehicleTableBody');
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    try {
        const res = await fetch('/api/vehicles');
        const data = await res.json();

        if (!Array.isArray(data)) {
            console.error("Server error detail:", data);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" style="color:red; text-align:center;">Server Error: ${data.error || 'Check database'}</td></tr>`;
            return;
        }

        const vehicles = data;

        // --- UPDATE ALL THREE CHARTS ---
        
        // 1. Total Vehicles
        const totalEl = document.getElementById('total-vehicles-count') || document.getElementById('total-vehicles');
        if (totalEl) totalEl.innerText = vehicles.length;

        // 2. Active/On Route (Counting vehicles with an actual route assigned)
        const activeEl = document.getElementById('active-vehicles-count') || document.getElementById('active-vehicles');
        if (activeEl) {
            const activeCount = vehicles.filter(v => v.route_name && v.route_name.toLowerCase() !== 'unassigned').length;
            activeEl.innerText = activeCount;
        }

        // 3. Expiring Soon (Insurance expiring in < 30 days)
       
const expiringEl = document.getElementById('expired-count'); // Updated to match your HTML ID
if (expiringEl) {
    const expiringCount = vehicles.filter(v => {
        if (!v.insurance_expiry) return false;
        const expiry = new Date(v.insurance_expiry);
        
        // This includes everything from the past (EXPIRED) 
        // up to 30 days in the future (EXPIRING)
        return expiry <= thirtyDaysFromNow; 
    }).length;
    expiringEl.innerText = expiringCount;
}
        if (!tableBody) return;

        // --- RENDER TABLE ---
        tableBody.innerHTML = vehicles.map(v => {
            const expiryDate = v.insurance_expiry ? new Date(v.insurance_expiry) : null;
            let rowClass = '';
            let statusLabel = 'NO DATE';
            let dateDisplay = 'N/A';

            if (expiryDate && !isNaN(expiryDate)) {
                dateDisplay = expiryDate.toLocaleDateString();
                if (expiryDate < today) {
                    rowClass = 'table-danger';
                    statusLabel = 'EXPIRED';
                } else if (expiryDate <= thirtyDaysFromNow) {
                    rowClass = 'table-warning';
                    statusLabel = 'EXPIRING';
                } else {
                    rowClass = '';
                    statusLabel = 'ACTIVE';
                }
            }

            return `
                <tr class="${rowClass}">
                    <td><strong>${v.reg_prefix || ''} ${v.reg_number || ''}</strong></td>
                    <td>${v.model || 'N/A'}</td>
                    <td>${v.route_name || 'Unassigned'}</td>
                    <td style="font-weight: bold; color: #059669;">
                        KES ${parseFloat(v.daily_target || 0).toLocaleString()}
                    </td>
                    <td>${dateDisplay}</td>
                    <td>
                        <span class="badge ${statusLabel === 'ACTIVE' ? 'badge-driver' : (statusLabel === 'EXPIRED' ? 'badge-danger' : 'badge-conductor')}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td>
                        <button onclick='editVehicle(${JSON.stringify(v).replace(/"/g, '&quot;')})' class="btn-edit">Edit</button>
                        <button onclick="deleteVehicle(${v.vehicle_id || v.id})" class="btn-delete">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading vehicles:", err);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Failed to connect to server.</td></tr>';
    }
}

function editVehicle(vehicle) {
    const form = document.getElementById('vehicleForm');
    if (!form) return;

    form.dataset.editId = vehicle.vehicle_id || vehicle.id; 
    
    document.getElementById('reg_prefix').value = vehicle.reg_prefix || '';
    document.getElementById('reg_number').value = vehicle.reg_number || '';
    document.getElementById('model').value = vehicle.model || '';
    document.getElementById('route_name').value = vehicle.route_name || '';
    document.getElementById('daily_target').value = vehicle.daily_target || 0;
    
    if (vehicle.insurance_expiry) {
        document.getElementById('insurance_expiry').value = vehicle.insurance_expiry.split('T')[0];
    } else {
        document.getElementById('insurance_expiry').value = '';
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Update Vehicle";
    window.scrollTo(0, 0); 
}

async function deleteVehicle(id) {
    if (confirm("Are you sure? This cannot be undone.")) {
        try {
            const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
            if (res.ok) loadVehicles();
        } catch (err) {
            console.error("Delete error:", err);
        }
    }
}