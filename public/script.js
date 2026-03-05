//index.html
// Load report on page load
document.addEventListener('DOMContentLoaded', fetchReport);

// Handle Form Submission
document.getElementById('vehicleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        regNo: document.getElementById('regNo').value,
        model: document.getElementById('model').value,
        routeInfo: document.getElementById('route').value
    };

    const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        alert('Vehicle Registered Successfully!');
        document.getElementById('vehicleForm').reset();
        fetchReport(); // Refresh the table
    }
});

// Fetch Performance Report
async function fetchReport() {
    const response = await fetch('/api/reports/maintenance-summary');
    const data = await response.json();
    
    const tableBody = document.getElementById('reportTable');
    tableBody.innerHTML = ''; // Clear old data

    data.forEach(row => {
        tableBody.innerHTML += `
            <tr>
                <td>${row.reg_no}</td>
                <td>${row.model}</td>
                <td>${row.total_visits}</td>
                <td>${parseFloat(row.total_expenses || 0).toLocaleString()}</td>
            </tr>
        `;
    });
}

