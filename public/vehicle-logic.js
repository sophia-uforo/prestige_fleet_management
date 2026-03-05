// Wrap EVERYTHING in this function
document.addEventListener('DOMContentLoaded', () => {
    
    const vehicleForm = document.getElementById('vehicleForm');

    // Only add the listener if the form actually exists on this page
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // ... your existing submit logic ...
            console.log("Form submitted!");
        });
    }

    // Load the table as soon as the page is ready
    loadVehicles();
});

// 1. Handle Form Submission (Add Vehicle)
document.getElementById('vehicleForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        reg_prefix: document.getElementById('reg_prefix').value,
        reg_number: document.getElementById('reg_number').value,
        model: document.getElementById('model').value,
        insurance_expiry: document.getElementById('insurance_expiry').value,
        route_name: document.getElementById('route_name').value
    };

    try {
        const response = await fetch('/api/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert("Vehicle added successfully!");
            // Instead of reload(), we just call loadVehicles() to keep it smooth
            document.getElementById('vehicleForm').reset();
            loadVehicles(); 
        } else {
            alert("Failed to add vehicle. Check server logs.");
        }
    } catch (err) {
        console.error("Error adding vehicle:", err);
    }
});

// 2. Load Vehicles with Insurance Status Highlighting
async function loadVehicles() {
    try {
        const res = await fetch('/api/vehicles');
        const vehicles = await res.json();
        const tableBody = document.getElementById('vehicleTableBody');
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        tableBody.innerHTML = vehicles.map(v => {
            const expiryDate = new Date(v.insurance_expiry);
            
            let statusClass = '';
            if (expiryDate < today) {
                statusClass = 'status-expired'; // CSS: light red background
            } else if (expiryDate <= thirtyDaysFromNow) {
                statusClass = 'status-warning'; // CSS: light yellow background
            }

            return `
                <tr class="${statusClass}">
                    <td><strong>${v.reg_prefix} ${v.reg_number}</strong></td>
                    <td>${v.model}</td>
                    <td>${v.route_name || 'Unassigned'}</td>
                    <td>${expiryDate.toLocaleDateString()}</td>
                    <td>
                        <button onclick="editVehicle(${v.id})" class="btn-edit">Edit</button>
                        <button onclick="deleteVehicle(${v.id})" class="btn-delete">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Error loading vehicles:", err);
    }
}

// 3. Delete Vehicle Function
async function deleteVehicle(id) {
    if (confirm("Are you sure you want to remove this vehicle from the fleet?")) {
        try {
            const res = await fetch(`/api/vehicles/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                loadVehicles(); // Refresh the table
            } else {
                alert("Failed to delete vehicle.");
            }
        } catch (err) {
            console.error("Error deleting vehicle:", err);
        }
    }
}

// Initial load when the page opens
loadVehicles();