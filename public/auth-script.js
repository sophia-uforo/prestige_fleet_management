let isLogin = true;

// 2. Toggle between Login and Register
function toggleAuth() {
    isLogin = !isLogin;
    document.getElementById('auth-title').innerText = isLogin ? 'Login to PFMS' : 'Register for PFMS';
    document.getElementById('reg-fields').style.display = isLogin ? 'none' : 'block';
    document.getElementById('submit-btn').innerText = isLogin ? 'Login' : 'Register';
    
    document.getElementById('toggle-text').innerHTML = isLogin ? 
        `Don't have an account? <a href="#" onclick="toggleAuth()">Register here</a>` : 
        `Already have an account? <a href="#" onclick="toggleAuth()">Login here</a>`;
}

// 3. Handle Form Submission
const authForm = document.getElementById('authForm');

// ONLY run this code if the form is found on the current page
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

            if (response.ok && result.user) {
                localStorage.setItem('userRole', result.user.role);
                localStorage.setItem('userName', result.user.name);
               if (result.user.role === 'Manager') { 
                window.location.href = (result.user.role === 'Manager') ? 'management.html' : 'staff.html';
            } else {
                window.location.href = 'staff.html';
            }
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

// 4. Logout Function
function logout() {
    // 1. Clear all session data
    localStorage.removeItem('userRole');
    localStorage.setItem('userName', ''); 
    localStorage.clear(); // Nuclear option to ensure everything is gone

    // 2. Teleport back to login
    window.location.replace('auth.html');
}