// İstifadəçi seansını serverdə JWT ilə doğrulamaq
async function checkUserSession() {
  const token = localStorage.getItem('elanMekani_token');
  const userSection = document.getElementById('userSection');
  if (!userSection) return;

  if (token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        userSection.innerHTML = `
          <span class="user-badge" style="background: #27ae60; color: #fff; padding: 6px 12px; border-radius: 20px; margin-right: 8px;">👤 ${currentUser.name}</span>
          <button class="auth-btn" onclick="logoutUser()">Çıxış</button>
        `;
        return;
      }
    } catch (err) {
      console.error("Seans yoxlanmasında xəta:", err);
    }
  }

  // Token yoxdursa və ya vaxtı keçibsə
  currentUser = null;
  localStorage.removeItem('elanMekani_token');
  userSection.innerHTML = `
    <button class="auth-btn" onclick="openAuthModal()">🔑 Giriş / Qeydiyyat</button>
  `;
}

// Həqiqi Login və Qeydiyyat Sorğusu (JWT + Bcrypt Backend)
async function handleAuthSubmit(e) {
  e.preventDefault();

  const email = document.getElementById('userEmail').value;
  const password = document.getElementById('userPassword').value;
  const name = isRegisterMode ? document.getElementById('userName').value : '';

  const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
  const payload = isRegisterMode ? { name, email, password } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('elanMekani_token', data.token);
      currentUser = data.user;
      closeAuthModal();
      checkUserSession();
      alert(`✅ ${data.message}`);
      document.getElementById('authForm').reset();
    } else {
      alert(`🚫 ${data.message || "Xəta baş verdi"}`);
    }
  } catch (error) {
    alert("Serverlə əlaqə xətası!");
  }
}

// Çıxış etmək
function logoutUser() {
  currentUser = null;
  localStorage.removeItem('elanMekani_token');
  checkUserSession();
  alert("Sistemdən çıxış edildi.");
}
