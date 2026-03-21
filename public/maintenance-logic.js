document.addEventListener('DOMContentLoaded', () => {
    // 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        const welcomeEl = document.getElementById('welcome-msg');
        if (welcomeEl) welcomeEl.innerText = `Welcome, ${savedName}`;
    }

    // 2. Initial Load
    loadVehicleDropdown();
    loadMaintenanceLogs();

    // 3. Handle Form Submission (Includes Update Logic)
    const maintForm = document.getElementById('maintenanceForm');
    if (maintForm) {
        maintForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const editingId = maintForm.dataset.editingId; // Check if we are updating

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
                // If we are editing, we delete the old record first
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
                    
                    // Reset Form State
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

async function loadMaintenanceLogs() {
    const tbody = document.getElementById('maintenanceTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/maintenance');
        if (!res.ok) throw new Error("Not JSON");
        const logs = await res.json();
        
        const userRole = (localStorage.getItem('userRole') || '').toLowerCase();
        const todayStr = new Date().toISOString().split('T')[0];

        tbody.innerHTML = logs.map(log => {
            // Check if log was created today
            const isToday = log.service_date.split('T')[0] === todayStr;
            
            let actionHtml = '';
            if (userRole === 'manager') {
                actionHtml = `<button class="btn-delete" onclick="deleteLog(${log.log_id})">Remove</button>`;
            } else if (isToday) {
                actionHtml = `
                    <div class="action-group">
                        <button class="btn-edit-small" onclick='editLog(${JSON.stringify(log)})'>Edit</button>
                        <button class="btn-delete-small" onclick="deleteLog(${log.log_id})">Delete</button>
                    </div>`;
            } else {
                actionHtml = `<span class="status-locked">🔒 Locked</span>`;
            }

            return `
                <tr>
                    <td><strong>${log.reg_no}</strong></td>
                    <td>${log.service_type}</td>
                    <td>${log.garage_name}</td>
                    <td>${new Date(log.service_date).toLocaleDateString()}</td>
                    <td>$${parseFloat(log.cost).toLocaleString()}</td>
                    <td><small>${log.details}</small></td>
                    <td>${actionHtml}</td>
                </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7">Error loading logs.</td></tr>';
    }
}

function editLog(log) {
    const form = document.getElementById('maintenanceForm');
    document.getElementById('maintVehicleSelect').value = log.vehicle_id;
    document.getElementById('serviceType').value = log.service_type;
    document.getElementById('garageName').value = log.garage_name;
    document.getElementById('serviceDate').value = log.service_date.split('T')[0];
    document.getElementById('maintCost').value = log.cost;
    document.getElementById('maintDetails').value = log.details;

    form.dataset.editingId = log.log_id;
    const btn = form.querySelector('button[type="submit"]');
    btn.innerText = "Update Record";
    btn.style.background = "#3b82f6";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteLog(id) {
    if (!confirm("Remove this record?")) return;
    try {
        const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
        if (res.ok) loadMaintenanceLogs();
    } catch (err) { console.error(err); }
}