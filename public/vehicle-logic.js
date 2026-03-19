// 1. Wrap everything in a single DOMContentLoaded to ensure elements are ready
document.addEventListener('DOMContentLoaded', () => {
    
    // Set Welcome Message
    const savedName = localStorage.getItem('userName');
    const welcomeMsg = document.getElementById('welcome-msg');
    if (savedName && welcomeMsg) {
        welcomeMsg.innerText = `Welcome, ${savedName}`;
    }

    const vehicleForm = document.getElementById('vehicleForm');

    // 2. Unified Handle Form Submission
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Prepare data exactly as the server expects
            const data = {
                reg_prefix: document.getElementById('reg_prefix').value.toUpperCase(),
                reg_number: document.getElementById('reg_number').value.toUpperCase(),
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
                    vehicleForm.reset();
                    loadVehicles(); // Refresh the table and stats automatically
                } else {
                    const errData = await response.json();
                    alert("Error: " + (errData.message || "Failed to add vehicle."));
                }
            } catch (err) {
                console.error("Error adding vehicle:", err);
                alert("Server connection failed.");
            }
        });
    }

    // 3. Initial load of the table and stats
    loadVehicles();
});

// 4. Load Vehicles with Insurance Status Highlighting & Stats
async function loadVehicles() {
    try {
        const res = await fetch('/api/vehicles');
        const vehicles = await res.json();
        const tableBody = document.getElementById('vehicleTableBody');
        
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        // --- Update Dashboard Stats ---
        const expiredList = vehicles.filter(v => new Date(v.insurance_expiry) < today);
        const activeRoutes = vehicles.filter(v => v.route_name && v.route_name.trim() !== '');

        if(document.getElementById('total-vehicles-count')) {
            document.getElementById('total-vehicles-count').innerText = vehicles.length;
            document.getElementById('active-routes-count').innerText = activeRoutes.length;
            document.getElementById('expired-count').innerText = expiredList.length;
        }

        // --- Render Table ---
        if (tableBody) {
            tableBody.innerHTML = vehicles.map(v => {
                const expiryDate = new Date(v.insurance_expiry);
                
                let rowStyle = '';
                let statusLabel = 'ACTIVE';
                let badgeClass = 'badge-driver'; // Uses the green badge style from CSS

                if (expiryDate < today) {
                    rowStyle = 'style="background-color: #fef2f2;"'; // Light red row
                    statusLabel = 'EXPIRED';
                    badgeClass = 'badge-conductor'; // Uses the red/blue badge style from CSS
                } else if (expiryDate <= thirtyDaysFromNow) {
                    rowStyle = 'style="background-color: #fffbeb;"'; // Light yellow row
                    statusLabel = 'EXPIRING SOON';
                    // Optional: add a specific warning badge class if you have one
                }

                return `
                    <tr ${rowStyle}>
                        <td><strong>${v.reg_prefix} ${v.reg_number}</strong></td>
                        <td>${v.model}</td>
                        <td>${v.route_name || 'Unassigned'}</td>
                        <td>${expiryDate.toLocaleDateString()}</td>
                        <td>
                            <span class="badge ${badgeClass}">${statusLabel}</span>
                        </td>
                        <td>
                            <button onclick="deleteVehicle(${v.id})" class="btn-delete">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error("Error loading vehicles:", err);
    }
}

// 5. Delete Vehicle Function (Global scope for button click)
async function deleteVehicle(id) {
    if (confirm("Are you sure you want to remove this vehicle from the fleet?")) {
        try {
            const res = await fetch(`/api/vehicles/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                loadVehicles(); // Refresh after deletion
            } else {
                alert("Failed to delete vehicle. Note: You cannot delete a vehicle that is currently assigned to a staff member.");
            }
        } catch (err) {
            console.error("Error deleting vehicle:", err);
        }
    }
}