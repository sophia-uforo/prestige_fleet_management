document.addEventListener('DOMContentLoaded', () => {
    // 1. Set Welcome Message
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    // 2. Handle Vehicle Assignment Form
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
        populateDropdowns(); 
        
        assignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                staffId: document.getElementById('staffSelect').value,
                vehicleId: document.getElementById('vehicleSelect').value,
                startDate: document.getElementById('assignmentDate').value
            };

            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert("Assignment Successful!");
                loadStaff(); 
            }
        });
    }

    // 3. Handle Staff Registration Form
    const staffForm = document.getElementById('staffForm'); // Fixed: Added this definition
    if (staffForm) {
        staffForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const staffData = {
                type: document.getElementById('type').value,
                name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                license: document.getElementById('license').value
            };

            try {
                const response = await fetch('/api/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(staffData)
                });

                if (response.ok) {
                    staffForm.reset();
                    loadStaff(); 
                }
            } catch (err) {
                console.error("Error registering staff:", err);
            }
        });
    }

    // 4. Initial Load
    loadStaff();
});

// --- HELPER FUNCTIONS ---

async function populateDropdowns() {
    const staffRes = await fetch('/api/staff');
    const staff = await staffRes.json();
    const staffSelect = document.getElementById('staffSelect');
    
    // Note: using s.id because of our 'AS id' alias in server.js
    staffSelect.innerHTML = '<option value="">Choose Staff...</option>' + 
        staff.map(s => `<option value="${s.id}">${s.full_name} (${s.staff_type})</option>`).join('');

    const vehRes = await fetch('/api/vehicles');
    const vehicles = await vehRes.json();
    const vehicleSelect = document.getElementById('vehicleSelect');
    vehicleSelect.innerHTML = '<option value="">Choose Vehicle...</option>' + 
        vehicles.map(v => `<option value="${v.id}">${v.reg_prefix} ${v.reg_number}</option>`).join('');
}

async function loadStaff() {
    try {
        const res = await fetch('/api/staff');
        const staff = await res.json();
        
        // Stats
        document.getElementById('total-staff-count').innerText = staff.length;
        document.getElementById('driver-count').innerText = staff.filter(s => s.staff_type === 'Driver').length;
        document.getElementById('conductor-count').innerText = staff.filter(s => s.staff_type === 'Conductor').length;
        document.getElementById('current-date').innerText = new Date().toLocaleDateString();

        // Table
        const tbody = document.getElementById('staffTableBody');
        if (tbody) {
            tbody.innerHTML = staff.map(s => `
                <tr>
                    <td><span class="badge ${s.staff_type === 'Driver' ? 'badge-driver' : 'badge-conductor'}">${s.staff_type}</span></td>
                    <td><strong>${s.full_name}</strong></td>
                    <td>${s.contact_number}</td>
                    <td><code>${s.license_details || 'N/A'}</code></td>
                    <td style="color: #2563eb; font-weight: bold;">
                        ${s.reg_prefix ? s.reg_prefix + ' ' + s.reg_number : 'Unassigned'}
                    </td>
                    <td>${new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="deleteStaff(${s.id})" class="btn-delete">Remove</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error("Error loading dashboard:", err);
    }
}

async function deleteStaff(id) {
    if (confirm("Are you sure you want to remove this staff member?")) {
        try {
            // Updated to match a standard DELETE route
            const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadStaff();
            } else {
                alert("Failed to delete staff member.");
            }
        } catch (err) {
            console.error("Delete error:", err);
        }
    }
}