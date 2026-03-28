document.addEventListener('DOMContentLoaded', async () => {
    // 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        const welcomeEl = document.getElementById('welcome-msg');
        if (welcomeEl) welcomeEl.innerText = `Welcome, ${savedName}`;
    }

    // --- FIXED: Added the second / to make this a proper comment ---
    // Check if the role is Staff to hide the "Add" form
    const role = localStorage.getItem('userRole');
    if (role !== 'Manager') {
        const formSection = document.getElementById('maintenance-form-container');
        if (formSection) formSection.style.display = 'none';
    }

    // 2. Initial Load (Using the correct function name)
    await loadVehicleDropdown();
    await loadMaintenanceLogs(); 

    // 3. Handle Form Submission
    const maintForm = document.getElementById('maintenanceForm');
    if (maintForm) {
        maintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editingId = maintForm.dataset.editingId; 

            const logData = {
                vehicle_id: document.getElementById('maintVehicleSelect').value,
                service_type: document.getElementById('serviceType').value,
                garage_name: document.getElementById('garageName').value,
                service_date: document.getElementById('serviceDate').value,
                cost: document.getElementById('maintCost').value,
                details: document.getElementById('maintDetails').value,
                reported_by: localStorage.getItem('userName') || 'Staff'
            };

            try {
                if (editingId) {
                    await fetch(`/api/maintenance/${editingId}`, { method: 'DELETE' });
                }

                const response = await fetch('/api/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logData)
                });

                if (response.ok) {
                    alert(editingId ? "✅ Record updated!" : "✅ Log submitted!");
                    maintForm.reset();
                    delete maintForm.dataset.editingId;
                    const submitBtn = maintForm.querySelector('button[type="submit"]');
                    submitBtn.innerText = "Submit Log";
                    submitBtn.style.background = "#10b981";
                    loadMaintenanceLogs(); 
                }
            } catch (err) {
                console.error("Submission error:", err);
            }
        });
    }
});

async function loadVehicleDropdown() {
    try {
        const res = await fetch('/api/vehicles');
        const vehicles = await res.json();
        const select = document.getElementById('maintVehicleSelect');
        if (select) {
            select.innerHTML = '<option value="">Select Vehicle...</option>' + 
                vehicles.map(v => `<option value="${v.vehicle_id}">${v.reg_prefix} ${v.reg_number}</option>`).join('');
        }
    } catch (err) { console.error(err); }
}

// --- FIXED: Renamed this from loadMaintenanceData to loadMaintenanceLogs to match the calls ---
async function loadMaintenanceLogs() {
    const role = localStorage.getItem('userRole');
    const id = localStorage.getItem('userId');
    const todayStr = new Date().toISOString().split('T')[0];

    try {
        const response = await fetch('/api/maintenance', {
            method: 'GET',
            headers: {
                'user-role': role,
                'user-id': id
            }
        });

        const logs = await response.json();
        const tableBody = document.getElementById('maintenanceTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = logs.map(log => {
            const isToday = log.service_date.split('T')[0] === todayStr;
            const actualId = log.id;
          
            const garage = log.garage_name || 'N/A';
    const sDate = log.service_date ? new Date(log.service_date).toLocaleDateString() : 'N/A';
    const cost = log.cost ? parseFloat(log.cost).toLocaleString() : '0';

            let actionHtml = '';
            if (role === 'Manager') {
                actionHtml = `<button class="btn-delete" onclick="deleteMaintenance(${actualId})">Remove</button>`;
            } else if (isToday) {
                actionHtml = `
                    <div class="action-group">
                        <button class="btn-edit-small" onclick='editLog(${JSON.stringify(log)})'>Edit</button>
                        <button class="btn-delete-small" onclick="deleteMaintenance(${actualId})">Delete</button>
                    </div>`;
            } else {
                actionHtml = `<span class="status-locked">🔒 Locked</span>`;
            }

         return `
        <tr>
            <td><strong>${log.reg_prefix || ''} ${log.reg_number || 'Vehicle'}</strong></td>
            <td>${log.service_type}</td>
            <td>${garage}</td>
            <td>${sDate}</td>
            <td>KES ${cost}</td>
            <td><small>${log.details || ''}</small></td>
            <td>
                <button class="btn-delete-small" onclick="deleteMaintenance(${log.id})">Delete</button>
            </td>
        </tr>`;
}).join('');
    } catch (err) {
        console.error("Error rendering table:", err);
    }
}

// Global functions for buttons
function editLog(log) {
    const form = document.getElementById('maintenanceForm');
    document.getElementById('maintVehicleSelect').value = log.vehicle_id;
    document.getElementById('serviceType').value = log.service_type;
    document.getElementById('garageName').value = log.garage_name;
    document.getElementById('serviceDate').value = log.service_date.split('T')[0];
    document.getElementById('maintCost').value = log.cost;
    document.getElementById('maintDetails').value = log.details;

    form.dataset.editingId = log.log_id || log.id;

    const btn = form.querySelector('button[type="submit"]');
    btn.innerText = "Update Record";
    btn.style.background = "#3b82f6";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteMaintenance(id) {
    if (!id || id === "undefined") {
        alert("Error: Record ID is missing.");
        return;
    }

    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
        const response = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
        if (response.ok) {
            loadMaintenanceLogs(); 
        } else {
            const errorData = await response.json();
            alert("Error: " + errorData.error);
        }
    } catch (err) {
        console.error("Delete Error:", err);
    }
}