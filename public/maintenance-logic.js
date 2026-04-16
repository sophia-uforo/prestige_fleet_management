document.addEventListener('DOMContentLoaded', async () => {
    // 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        const welcomeEl = document.getElementById('welcome-msg');
        if (welcomeEl) welcomeEl.innerText = `Welcome, ${savedName}`;
    }

    // Check if the role is Staff to hide the "Add" form
    const role = localStorage.getItem('userRole');
    if (role !== 'Manager') {
        const formSection = document.getElementById('maintenance-form-container');
        if (formSection) formSection.style.display = 'none';
    }

    // 2. Initial Load
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

async function loadMaintenanceLogs() {
    const role = localStorage.getItem('userRole');
    const id = localStorage.getItem('userId');

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
            // --- SMART ALIASES: These find data even if column names are slightly different ---
             const garage = log.garage_name || 'N/A';
            
            // Safe Date Formatting
            const rawDate = log.service_date || log.log_date;
            const sDate = log.service_date ? new Date(log.service_date).toLocaleDateString() : 'N/A';
            
            const cost = log.cost ? parseFloat(log.cost).toLocaleString() : '0';
            const actualId = log.id || log.log_id;

            return `
            <tr>
                <td><strong>${log.reg_prefix || ''} ${log.reg_number || 'Vehicle'}</strong></td>
                <td>${log.service_type || 'N/A'}</td>
                <td>${garage}</td>
                <td>${sDate}</td>
                <td>KES ${cost}</td>
                <td><small>${log.details || ''}</small></td>
                <td>
                    <button class="btn-delete-small" onclick="deleteMaintenance(${actualId})">Delete</button>
                    <button class="btn-edit-small" onclick='editLog(${JSON.stringify(log)})'>Edit</button>
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
    
    // Fill the form fields safely
    document.getElementById('maintVehicleSelect').value = log.vehicle_id || '';
    document.getElementById('serviceType').value = log.service_type || '';
    document.getElementById('garageName').value = log.garage_name || log.garage_location || '';
    
    // Safe Date Splitting for the input field (expects YYYY-MM-DD)
    const rawDate = log.service_date || log.log_date;
    if (rawDate) {
        // Handle both ISO strings and standard strings
        document.getElementById('serviceDate').value = rawDate.toString().split('T')[0];
    } else {
        document.getElementById('serviceDate').value = '';
    }

    document.getElementById('maintCost').value = log.cost || '';
    document.getElementById('maintDetails').value = log.details || '';

    // Track the ID for the update logic
    form.dataset.editingId = log.id || log.log_id;

    // UI Updates
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
        btn.innerText = "Update Record";
        btn.style.background = "#3b82f6";
    }
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
            alert("Could not delete the record.");
        }
    } catch (err) {
        console.error("Delete Error:", err);
    }
}