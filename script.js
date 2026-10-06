// Backend API Ünvanı
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
    
    // Backend cavabının formatından asılı olmayaraq məlumatı təhlükəsiz oxuyuruq
    if (Array.isArray(data)) {
      listings = data;
    } else if (data && data.listings) {
      listings = data.listings;
    } else {
      listings = [];
    }

    renderCards();
    
    const trashCountEl = document.getElementById('trashCount');
    if (trashCountEl) {
      trashCountEl.textContent = data.trashCount || trashListings.length || 0;
    }
  } catch (error) {
    console.error("Backend serverinə bağlanmaq mümkün olmadı:", error);
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
  const searchInputEl = document.getElementById('searchInput');
  const searchInput = searchInputEl ? searchInputEl.value.toLowerCase().trim() : '';

  if (!grid) return;
  grid.innerHTML = '';

  const filtered = listings.filter(item => {
    const matchesCategory = (currentCategory === 'all' || item.category === currentCategory);
    const matchesSearch = (item.title && item.title.toLowerCase().includes(searchInput)) ||
                          (item.description && item.description.toLowerCase().includes(searchInput));
    return matchesCategory && matchesSearch;
  });

  updateCounters();

  if (filtered.length === 0) {
    if (noResults) noResults.style.display = 'block';
    return;
  } else {
    if (noResults) noResults.style.display = 'none';
  }

  filtered.forEach(item => {
    const isCar = item.category === 'car';
    const badgeText = isCar ? 'Maşın' : 'Mal-Qara';
    const badgeClass = isCar ? 'badge-car' : 'badge-animal';
    const imageClass = item.image === 'Quzu.png' ? 'card-img-landscape' : '';

    // Nömrəni təmizləyirik
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
  const countAll = document.getElementById('count-all');
  const countCar = document.getElementById('count-car');
  const countAnimal = document.getElementById('count-animal');

  if (countAll) countAll.textContent = listings.length;
  if (countCar) countCar.textContent = listings.filter(i => i.category === 'car').length;
  if (countAnimal) countAnimal.textContent = listings.filter(i => i.category === 'animal').length;
}

// Elanı Zibil Qutusuna Atmaq
async function deleteListing(id) {
  if (!confirm("Bu elanı zibil qutusuna atmaq istədiyinizdən əminsiniz?")) return;

  try {
    const res = await fetch(`${API_URL}/listings/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && (data.success || Array.isArray(data))) {
      alert("Elan Zibil Qutusuna atıldı!");
      await loadData();
    } else {
      alert(data.message || "Xəta baş verdi.");
    }
  } catch (error) {
    alert("Serverlə əlaqə xətası!");
  }
}

// Zibil Qutusundakı Elanı Geri Bərpa Etmək
async function restoreListing(id) {
  try {
    const res = await fetch(`${API_URL}/trash/restore/${id}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
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
  const overlay = document.getElementById('trashModalOverlay');
  if (overlay) overlay.style.display = 'flex';

  const trashList = document.getElementById('trashList');
  if (trashList) trashList.innerHTML = '<p style="text-align:center; padding:20px;">Yüklənir...</p>';

  try {
    const res = await fetch(`${API_URL}/trash`);
    const data = await res.json();
    trashListings = data.trash || (Array.isArray(data) ? data : []);
    renderTrashList();
  } catch (error) {
    if (trashList) {
      trashList.innerHTML = '<p style="text-align:center; padding:20px; color:red;">Zibil qutusunu yükləmək mümkün olmadı.</p>';
    }
  }
}

function closeTrashModal() {
  const overlay = document.getElementById('trashModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function renderTrashList() {
  const trashList = document.getElementById('trashList');
  if (!trashList) return;
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

// Yeni Elan Göndərmək
async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.querySelector('#addForm .btn-submit');
  const originalBtnText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.textContent = "🤖 AI Yoxlayır...";
    submitBtn.disabled = true;
  }

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

    if (res.ok && (data.success || data.id)) {
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
    if (submitBtn) {
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  }
}

// İlkin Baza Bərpası (MongoDB-ni Sıfırlayıb Nümunə Elanları Yükləyir)
async function resetInitialData() {
  if (confirm("Bütün elanları silib ilkin bazanı bərpa etmək istədiyinizdən əminsiniz?")) {
    try {
      const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
      const data = await res.json();
      if (data.success || Array.isArray(data)) {
        alert("✅ İlkin baza uğurla bərpa olundu!");
        await loadData();
      } else {
        alert("Bərpa zamanı xəta baş verdi.");
      }
    } catch (err) {
      alert("Serverlə əlaqə xətası!");
    }
  }
}

// Login & Qeydiyyat Mexanizmi
function checkUserSession() {
  const userSection = document.getElementById('userSection');
  if (!userSection) return;

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
function openAuthModal() { 
  const el = document.getElementById('authModalOverlay');
  if (el) el.style.display = 'flex'; 
}
function closeAuthModal() { 
  const el = document.getElementById('authModalOverlay');
  if (el) el.style.display = 'none'; 
}
function openModal() { 
  const el = document.getElementById('modalOverlay');
  if (el) el.style.display = 'flex'; 
}
function closeModal() { 
  const el = document.getElementById('modalOverlay');
  if (el) el.style.display = 'none'; 
}

function setCategory(category, btnElement) {
  currentCategory = category;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  renderCards();
}

function filterCards() { renderCards(); }
function setQuickImage(val) { 
  const imgInput = document.getElementById('image');
  if (imgInput) imgInput.value = val; 
}
