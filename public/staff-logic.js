document.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    // This matches the "Assign Staff to Vehicle" form ID in your HTML
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
        populateDropdowns(); 
        // Add this specific listener for the assignment form
        assignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // This stops the page from refreshing!
            await linkStaffToVehicle(); 
        });
    }
    
    loadStaff();

    const staffForm = document.getElementById('staffForm');
    if (staffForm) {
        staffForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const staffData = {
                role: document.getElementById('type').value,
                full_name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                license: document.getElementById('license').value
            };

            const staffId = staffForm.dataset.editId;
            const url = staffId ? `/api/staff/${staffId}` : '/api/staff';
            const method = staffId ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(staffData)
                });

                if (response.ok) {
                    alert(staffId ? "Staff updated!" : "Staff registered!");
                    staffForm.reset();
                    delete staffForm.dataset.editId;
                    const submitBtn = staffForm.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.innerText = "Register Staff";
                    loadStaff(); 
                    populateDropdowns(); 
                }
            } catch (err) {
                console.error("Error saving staff:", err);
            }
        });
    }
});

// --- GLOBAL FUNCTIONS (Must be outside DOMContentLoaded to be seen by buttons) ---

async function populateDropdowns() {
    const staffSelect = document.getElementById('staffSelect');
    const vehicleSelect = document.getElementById('vehicleSelect');

    if (!staffSelect || !vehicleSelect) return;

    try {
        // 1. Fill Staff Dropdown
        const sRes = await fetch('/api/staff');
        const staff = await sRes.json();
       // Inside populateDropdowns()
staffSelect.innerHTML = '<option value="">Choose Staff...</option>' + 
    staff.map(s => {
        // We use s.staff_id OR s.user_id depending on your API's column name
        const id = s.staff_id || s.user_id; 
        return `<option value="${id}">${s.full_name} (${s.role})</option>`;
    }).join('');

        // 2. Fill Vehicle Dropdown
        const vRes = await fetch('/api/vehicles');
        const vehicles = await vRes.json();
        vehicleSelect.innerHTML = '<option value="">Choose Vehicle...</option>' + 
            vehicles.map(v => `<option value="${v.vehicle_id}">${v.reg_prefix} ${v.reg_number}</option>`).join('');

    } catch (err) {
        console.error("Error filling dropdowns:", err);
    }
}

async function linkStaffToVehicle() {
    const staffSelectEl = document.getElementById('staffSelect');
    const vehicleSelectEl = document.getElementById('vehicleSelect');

    const assignmentDate = document.getElementById('assignmentDate').value;
    
    const staffId = staffSelectEl.value; // This must be a number, not empty
    const vehicleId = vehicleSelectEl.value;

    console.log("Linking Staff ID:", staffId); // Check your console for this!

    if (!staffId || staffId === "undefined") {
        alert("Error: Staff ID is missing. Please re-select the staff member.");
        return;
    }

    try {
        const res = await fetch(`/api/staff/assign/${staffId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                vehicle_id: vehicleId,
                date: assignmentDate 
            })
        });

        if (res.ok) {
            alert("Assignment Linked Successfully!");
            loadStaff(); 
        } else {
            const errorData = await res.json();
            alert("Error: " + errorData.error);
        }
    } catch (err) {
        console.error("Link error:", err);
    }
}

async function loadStaff() {
    const staffTableBody = document.getElementById('staffTableBody');
    const totalStaffEl = document.getElementById('total-staff-count');
    const activeDriversEl = document.getElementById('active-drivers-count');
    const activeConductorsEl = document.getElementById('active-conductors-count');

    try {
        const res = await fetch('/api/staff');
        const activeStaff = await res.json();

        const joinedDate = (s.date_joined) 
    ? new Date(s.date_joined).toLocaleDateString('en-GB') // DD/MM/YYYY format
    : 'N/A';
    
        if (!Array.isArray(activeStaff)) return;

        // Update Charts
        if (totalStaffEl) totalStaffEl.innerText = activeStaff.length;
        if (activeDriversEl) {
            activeDriversEl.innerText = activeStaff.filter(s => s.role === 'Driver').length;
        }
        if (activeConductorsEl) {
            activeConductorsEl.innerText = activeStaff.filter(s => s.role === 'Conductor').length;
        }

        if (!staffTableBody) return;

        // Render Table
        staffTableBody.innerHTML = activeStaff.map(s => {
            console.log("Date from server:",s.created_at);
            const joinedDate = (s.created_at && s.created_at !== 'N/A') ?new Date(s.created_at).toLocaleDateString():'N/A';
            const vehicleDisplay = (s.reg_prefix && s.reg_number) 
                ? `${s.reg_prefix} ${s.reg_number}` 
                : '<span style="color: #94a3b8;">Unassigned</span>';

            return `
                <tr>
                    <td><span class="badge ${s.role === 'Driver' ? 'badge-driver' : 'badge-conductor'}">${s.role}</span></td>
                    <td><strong>${s.full_name}</strong></td>
                    <td>${s.phone || 'No Phone'}</td>
                    <td>${s.license || 'N/A'}</td>
                    <td>${vehicleDisplay}</td>
                    <td>${joinedDate}</td>
                    <td>
                        <button onclick="editStaff(${JSON.stringify(s).replace(/"/g, '&quot;')})" class="btn-edit">Edit</button>
                        <button onclick="deleteStaff(${s.staff_id})" class="btn-delete">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Error loading staff:", err);
    }
}

function editStaff(staff) {
    const form = document.getElementById('staffForm');
    if (!form) return;
    
    form.dataset.editId = staff.staff_id;
    document.getElementById('type').value = staff.role;
    document.getElementById('name').value = staff.full_name;
    document.getElementById('phone').value = staff.phone || '';
    document.getElementById('license').value = staff.license || '';
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.innerText = "Update Staff Member";
    window.scrollTo(0, 0);
}

async function deleteStaff(id) {
    if (confirm("Are you sure?")) {
        try {
            const res = await fetch(`/api/staff/${id}`, { method: 'DELETE' });
            if (res.ok) loadStaff();
        } catch (err) {
            console.error("Delete error:", err);
        }
    }
}