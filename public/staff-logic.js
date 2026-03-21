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
    const staffTableBody = document.getElementById('staffTableBody');
    if (!staffTableBody) return;

    try {
        const res = await fetch('/api/staff');
        if (!res.ok) throw new Error("Could not fetch staff list");
        
        const data = await res.json();
        const staffArray = Array.isArray(data) ? data : [];

        // 1. FILTER: We only want to see Drivers and Conductors here
        const activeStaff = staffArray.filter(s => s.role.toLowerCase() !== 'manager');

        // 2. COUNTERS: Update the Dashboard Cards
        // Ensure these IDs match your HTML exactly
        const totalStaffEl = document.getElementById('total-staff-count');
        const driverCountEl = document.getElementById('driver-count');
        const conductorCountEl = document.getElementById('conductor-count');

        if (totalStaffEl) totalStaffEl.innerText = activeStaff.length;
        if (driverCountEl) driverCountEl.innerText = activeStaff.filter(s => s.role === 'Driver').length;
        if (conductorCountEl) conductorCountEl.innerText = activeStaff.filter(s => s.role === 'Conductor').length;

        // 3. RENDER TABLE: Use 'activeStaff' and 'staffTableBody'
        staffTableBody.innerHTML = activeStaff.map(s => `
            <tr>
                <td><span class="badge ${s.role === 'Driver' ? 'badge-driver' : 'badge-conductor'}">${s.role}</span></td>
                <td><strong>${s.full_name}</strong></td>
                <td>${s.email || 'No Email'}</td> 
                <td><button class="btn-view" onclick="viewDetails(${s.user_id})">View</button></td>
                <td style="color: #2563eb; font-weight: bold;">
                    ${s.assigned_vehicle || 'Unassigned'}
                </td>
                <td>${new Date(s.created_at).toLocaleDateString()}</td>
                <td>
                    <button onclick="deleteStaff(${s.user_id})" class="btn-delete">Remove</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Error loading dashboard:", err);
        staffTableBody.innerHTML = '<tr><td colspan="7">Error loading staff data.</td></tr>';
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

async function viewStaffDetails(id) {
    try {
        // HERE is where we use the specific ID
        const res = await fetch(`/api/staff/${id}`);
        const staff = await res.json();
        
        alert(`Staff Name: ${staff.full_name}\nRole: ${staff.role}\nAssigned Vehicle: ${staff.reg_number || 'None'}`);
        // You could also open a modal here instead of an alert
    } catch (err) {
        console.error("Error fetching details:", err);
    }
}