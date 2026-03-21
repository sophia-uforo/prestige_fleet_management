document.addEventListener('DOMContentLoaded', async () => {
    const staffId = localStorage.getItem('userId');
    const staffName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');
    
    // 1. SECURITY CHECK: Ensure only Staff (not Managers) access this
    if (!staffId || staffId === "undefined" || userRole === 'Manager') {
        window.location.href = userRole === 'Manager' ? 'dashboard.html' : 'auth.html';
        return;
    }

    // 2. INITIAL UI SETUP
    document.getElementById('staff-name').innerText = staffName || "Staff Member";
    let currentVehicleId = null;

    // 3. FETCH ASSIGNED VEHICLE DATA
    try {
        const response = await fetch(`/api/staff/${staffId}`);
        if (!response.ok) throw new Error("Profile fetch failed");
        
        const data = await response.json();
        
        document.getElementById('assigned-vehicle').innerText = `Assigned Vehicle: ${data.reg_prefix || ''} ${data.reg_number || 'None'}`;
        document.getElementById('staff-role').innerText = `Role: ${data.role || 'Staff'}`;
        
        currentVehicleId = data.vehicle_id; 

        // 3.5. CHECK IF LOG ALREADY EXISTS FOR TODAY
        if (currentVehicleId) {
            checkExistingLog(currentVehicleId);
        }

    } catch (err) {
        console.error("Portal Error:", err);
        document.getElementById('assigned-vehicle').innerText = "Status: Connection Error";
    }

    // 4. HANDLE THE SHIFT LOG SUBMISSION
    const logForm = document.getElementById('shiftLogForm');
    if (logForm) {
        logForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentVehicleId) {
                alert("Error: No vehicle assigned.");
                return;
            }

            const logData = {
                staff_id: staffId,
                vehicle_id: currentVehicleId,
                fuel_litres: document.getElementById('fuelLitres').value,
                fuel_cost: document.getElementById('fuelCost').value,
                total_collections: document.getElementById('collections').value
            };

            try {
                const res = await fetch('/api/daily-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logData)
                });

                const result = await res.json();

                if (res.ok) {
                    alert("✅ Shift log submitted successfully!");
                    location.reload(); // Reload to lock the form
                } else {
                    alert(`❌ ${result.message || "Failed to save log."}`);
                }
            } catch (err) {
                console.error("Submission Error:", err);
                alert("Server connection failed.");
            }
        });
    }
});

// Helper to disable form if already submitted by partner
async function checkExistingLog(vehicleId) {
    try {
        const res = await fetch(`/api/daily-logs/status/${vehicleId}`);
        const status = await res.json();

        if (status.alreadySubmitted) {
            const form = document.getElementById('shiftLogForm');
            // Disable all inputs and the button
            const elements = form.elements;
            for (let i = 0; i < elements.length; i++) {
                elements[i].disabled = true;
            }
            
            // Add a friendly message
            const msg = document.createElement('p');
            msg.style.color = '#059669'; // Green
            msg.style.fontWeight = 'bold';
            msg.style.marginTop = '10px';
            msg.innerText = "ℹ️ Today's log has already been submitted for this vehicle.";
            form.appendChild(msg);
        }
    } catch (err) {
        console.error("Error checking log status:", err);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'auth.html';
}