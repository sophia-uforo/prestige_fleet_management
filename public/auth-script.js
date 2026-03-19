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
    // Adding 'async' here makes the 'await' below valid
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

            if (response.ok) {
                // We use 'result' because that's where we saved the response.json()
                // Make sure your backend sends back 'user_role' and 'full_name'
                localStorage.setItem('userRole', result.role || result.user?.role);
                localStorage.setItem('userName', result.full_name || result.user?.name);
                
                // Smart Redirect
                if (localStorage.getItem('userRole') === 'Manager') {
                    window.location.href = 'staff.html';
                } else {
                    window.location.href = 'staff.html'; // Or whichever page drivers see
                }
            } else {
                alert(result.message || "Authentication failed");
            }
        } catch (err) {
            console.error("Connection Error:", err);
            alert("Server connection failed.");
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });
}

// 3. Logout Function
function logout() {
    localStorage.clear(); 
    window.location.replace('auth.html');
}