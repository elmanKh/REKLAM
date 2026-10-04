// Backend API Ünvanı (Serverimiz static faylları təqdim etdiyi üçün nisbi ünvandan istifadə edirik)
const API_URL = '/api';

// Qlobal dəyişənlər
let listings = [];
let trashListings = [];
let currentUser = null;
let currentCategory = 'all';
let isRegisterMode = false;

// Səhifə Yükləndikdə
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  checkUserSession();
});

// Verilənləri Serverdən (Node.js Backend-dən) Yükləmək
async function loadData() {
  try {
    const res = await fetch(`${API_URL}/listings`);
    const data = await res.json();
    if (data.success) {
      listings = data.listings;
      renderCards();
      document.getElementById('trashCount').textContent = data.trashCount || 0;
    }
  } catch (error) {
    console.error("Backend serverə bağlanmaq mümkün olmadı:", error);
  }

  // İstifadəçi seansını yoxlamaq
  const savedUser = localStorage.getItem('elanMekani_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    checkUserSession();
  }
}

// Kartları Göstərmək
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const noResults = document.getElementById('noResults');
  const searchInput = document.getElementById('searchInput').value.toLowerCase().trim();

  grid.innerHTML = '';

  const filtered = listings.filter(item => {
    const matchesCategory = (currentCategory === 'all' || item.category === currentCategory);
    const matchesSearch = item.title.toLowerCase().includes(searchInput) ||
                          item.description.toLowerCase().includes(searchInput);
    return matchesCategory && matchesSearch;
  });

  updateCounters();

  if (filtered.length === 0) {
    noResults.style.display = 'block';
    return;
  } else {
    noResults.style.display = 'none';
  }

  filtered.forEach(item => {
    const isCar = item.category === 'car';
    const badgeText = isCar ? 'Maşın' : 'Mal-Qara';
    const badgeClass = isCar ? 'badge-car' : 'badge-animal';
    const imageClass = item.image === 'Quzu.png' ? 'card-img-landscape' : '';

    // Nömrəni təmizləyirik: boşdursa və ya yoxdursa "994000000000" tətbiq edirik
    const rawPhone = item.phone ? String(item.phone).replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length > 5 ? rawPhone : "994000000000";

    const cardHTML = `
      <div class="card">
        <div class="card-img-container">
          <img class="card-img ${imageClass}" src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/500x300?text=Şəkil+Tapılmadı'">
          <button class="delete-btn" onclick="deleteListing(${item.id})" title="Zibil qutusuna at">🗑️</button>
        </div>
        <div class="card-body">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <h3 class="card-title">${item.title}</h3>
          <div class="card-price">${item.price}</div>
          <p class="card-desc">${item.description}</p>
          <a href="https://wa.me/${phone}?text=Salam,%20${encodeURIComponent(item.title)}%20elani%20ile%20bagli%20yaziram" target="_blank" class="chat-btn">
            💬 Əlaqə Çatı (WhatsApp)
          </a>
        </div>
      </div>
    `;

    grid.innerHTML += cardHTML;
  });
}

// Sayğaclar
function updateCounters() {
  document.getElementById('count-all').textContent = listings.length;
  document.getElementById('count-car').textContent = listings.filter(i => i.category === 'car').length;
  document.getElementById('count-animal').textContent = listings.filter(i => i.category === 'animal').length;
}

// Elanı Zibil Qutusuna Atmaq (Backend DELETE Sorğusu)
async function deleteListing(id) {
  try {
    const res = await fetch(`${API_URL}/listings/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      alert("Elan Zibil Qutusuna atıldı!");
      await loadData();
    } else {
      alert(data.message || "Xəta baş verdi.");
    }
  } catch (error) {
    alert("Serverlə əlaqə xətası!");
  }
}

// Zibil Qutusundakı Elanı Geri Bərpa Etmək (Backend RESTORE Sorğusu)
async function restoreListing(id) {
  try {
    const res = await fetch(`${API_URL}/trash/restore/${id}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      alert("Elan uğurla bərpa olundu!");
      await loadData();
      await openTrashModal();
    } else {
      alert(data.message || "Xəta baş verdi.");
    }
  } catch (error) {
    alert("Serverlə əlaqə xətası!");
  }
}

// Zibil Qutusunu Serverdən Oxuyub Göstərmək
async function openTrashModal() {
  document.getElementById('trashModalOverlay').style.display = 'flex';
  const trashList = document.getElementById('trashList');
  trashList.innerHTML = '<p style="text-align:center; padding:20px;">Yüklənir...</p>';

  try {
    const res = await fetch(`${API_URL}/trash`);
    const data = await res.json();
    if (data.success) {
      trashListings = data.trash;
      renderTrashList();
    }
  } catch (error) {
    trashList.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Zibil qutusunu yükləmək mümkün olmadı.</p>';
  }
}

function closeTrashModal() {
  document.getElementById('trashModalOverlay').style.display = 'none';
}

function renderTrashList() {
  const trashList = document.getElementById('trashList');
  trashList.innerHTML = '';

  if (trashListings.length === 0) {
    trashList.innerHTML = '<p style="text-align:center; padding:20px; color:#777;">Zibil qutusu boşdur.</p>';
    return;
  }

  trashListings.forEach(item => {
    trashList.innerHTML += `
      <div class="trash-item">
        <img src="${item.image}" onerror="this.src='https://via.placeholder.com/50'">
        <div class="trash-info">
          <h4>${item.title}</h4>
          <p>${item.price}</p>
        </div>
        <button class="restore-btn" onclick="restoreListing(${item.id})">↩️ Geri Bərpa Et</button>
      </div>
    `;
  });
}

// Yeni Elan Göndərmək (Backend POST + AI Moderasiya)
async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.querySelector('#addForm .btn-submit');
  const originalBtnText = submitBtn.textContent;
  submitBtn.textContent = "🤖 AI Yoxlayır...";
  submitBtn.disabled = true;

  const newListing = {
    title: document.getElementById('title').value,
    category: document.getElementById('category').value,
    price: document.getElementById('price').value,
    image: document.getElementById('image').value,
    phone: document.getElementById('phone').value.replace(/[^0-9]/g, ''),
    description: document.getElementById('description').value
  };

  try {
    const res = await fetch(`${API_URL}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newListing)
    });

    const data = await res.json();

    if (res.ok && data.success) {
      alert("✅ Elan uğurla əlavə olundu!");
      closeModal();
      document.getElementById('addForm').reset();
      await loadData();
    } else {
      alert(data.message || "🚫 Elan əlavə olunmadı!");
    }
  } catch (error) {
    alert("Serverlə əlaqə xətası! Serverin işlədiyindən əmin olun.");
  } finally {
    submitBtn.textContent = originalBtnText;
    submitBtn.disabled = false;
  }
}

// İlkin Baza Bərpası
function resetInitialData() {
  loadData();
}

// Login & Qeydiyyat Mexanizmi
function checkUserSession() {
  const userSection = document.getElementById('userSection');
  if (currentUser) {
    userSection.innerHTML = `
      <span class="user-badge">👤 ${currentUser.name}</span>
      <button class="auth-btn" onclick="logoutUser()">Çıxış</button>
    `;
  } else {
    userSection.innerHTML = `
      <button class="auth-btn" onclick="openAuthModal()">🔑 Giriş / Qeydiyyat</button>
    `;
  }
}

function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('userEmail').value;
  const name = isRegisterMode ? document.getElementById('userName').value : email.split('@')[0];

  currentUser = { name: name, email: email };
  localStorage.setItem('elanMekani_user', JSON.stringify(currentUser));
  checkUserSession();
  closeAuthModal();
  alert(`Xoş gəldiniz, ${name}!`);
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('elanMekani_user');
  checkUserSession();
}

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('authTitle').textContent = isRegisterMode ? "📝 Qeydiyyat" : "🔑 Hesaba Giriş";
  document.getElementById('nameGroup').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('authSubmitBtn').textContent = isRegisterMode ? "Qeydiyyatdan Keç" : "Daxil Ol";
  document.getElementById('toggleAuthBtn').textContent = isRegisterMode ? "Daxil Ol" : "Qeydiyyatdan keç";
}

// Modalların İdarəsi
function openAuthModal() { document.getElementById('authModalOverlay').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('authModalOverlay').style.display = 'none'; }
function openModal() { document.getElementById('modalOverlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

function setCategory(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  btnElement.classList.add('active');
  renderCards();
}

function filterCards() { renderCards(); }
function setQuickImage(val) { document.getElementById('image').value = val; }