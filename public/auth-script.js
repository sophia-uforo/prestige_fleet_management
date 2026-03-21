let isLogin = true;

// 1. Toggle between Login and Register
function toggleAuth() {
    isLogin = !isLogin;
    document.getElementById('auth-title').innerText = isLogin ? 'Login to PFMS' : 'Register for PFMS';
    document.getElementById('reg-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('submit-btn').innerText = isLogin ? 'Login' : 'Register';
    
    document.getElementById('toggle-text').innerHTML = isLogin ? 
        `Don't have an account? <a href="#" onclick="toggleAuth()">Register here</a>` : 
        `Already have an account? <a href="#" onclick="toggleAuth()">Login here</a>`;
}

// 2. Handle Form Submission
const authForm = document.getElementById('authForm');

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.innerText;
        
        submitBtn.innerText = "Processing...";
        submitBtn.disabled = true;

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        
        const payload = {
            email: document.getElementById('email').value,
            password: document.getElementById('password').value
        };

        if (!isLogin) {
            payload.name = document.getElementById('name').value;
            payload.role = document.getElementById('role').value;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            // --- DEBUGGING LOGS ---
            console.log("SERVER RESPONSE:", result);

            if (response.ok) {
                // 1. Dig into the 'user' object if it exists
                const userObj = result.user || {};
                
                // 2. Find the ID (Checks result.user_id, result.user.user_id, and result.id)
                const id = result.user_id || userObj.user_id || result.id || userObj.id;

                if (id) {
                    // Save to LocalStorage
                    localStorage.setItem('userId', id);
                    localStorage.setItem('userName', userObj.full_name || result.full_name || "User");
                    localStorage.setItem('userRole', userObj.role || result.role || "Staff");

                    // --- SMART REDIRECT ---
                    const finalRole = localStorage.getItem('userRole');
                    if (finalRole === 'Manager') {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'staff-portal.html';
                    }
                } else {
                    console.error("Critical: Auth succeeded but no ID found in response mapping.", result);
                    alert("System Error: User ID missing from server response.");
                }
            } else {
                alert(result.message || "Authentication failed");
            }
        } catch (err) {
            console.error("Connection Error:", err);
            alert("Server connection failed. Is your backend running?");
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Function to handle logging out
function logout() {
    // 1. Clear all saved user data
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    
    // Optional: Clear everything if you want a total reset
    // localStorage.clear();

    // 2. Redirect back to the login/auth page
    alert("You have been logged out.");
    window.location.href = 'auth.html';
}