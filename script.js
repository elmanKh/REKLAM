let currentListings = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  fetchListings();
});

// Backend API-dən elanları çəkən funksiya
async function fetchListings() {
  try {
    const res = await fetch('/api/listings');
    const data = await res.json();
    currentListings = data;
    renderUI();
  } catch (err) {
    console.error('Elanlar yüklənmədi:', err);
  }
}

// Ekranda elanları və sayğacları göstərən funksiya
function renderUI() {
  updateCounts();
  filterAndRenderListings();
}

function updateCounts() {
  const total = currentListings.length;
  const cars = currentListings.filter(item => item.category === 'car').length;
  const animals = currentListings.filter(item => item.category === 'animal').length;

  const btnAll = document.querySelector('[onclick*="all"], .btn-all-count');
  const btnCar = document.querySelector('[onclick*="car"], .btn-car-count');
  const btnAnimal = document.querySelector('[onclick*="animal"], .btn-animal-count');

  // Sayğac mətnlərini yeniləyirik
  if (document.getElementById('count-all')) document.getElementById('count-all').innerText = `(${total})`;
  if (document.getElementById('count-car')) document.getElementById('count-car').innerText = `(${cars})`;
  if (document.getElementById('count-animal')) document.getElementById('count-animal').innerText = `(${animals})`;
}

function filterCategory(cat) {
  currentCategory = cat;
  filterAndRenderListings();
}

function filterAndRenderListings() {
  const container = document.getElementById('listings-container') || document.querySelector('.listings-grid') || document.getElementById('listings');
  if (!container) return;

  const searchInput = document.getElementById('search-input') || document.querySelector('input[type="text"]');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = currentListings;

  if (currentCategory !== 'all') {
    filtered = filtered.filter(item => item.category === currentCategory);
  }

  if (query) {
    filtered = filtered.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.description.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 40px; width: 100%;">🔍 Qeyd etdiyiniz sorğuya uyğun elan tapılmadı.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="card" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px; background: #fff;">
      <img src="${item.image}" alt="${item.title}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 6px;" onerror="this.src='https://via.placeholder.com/300x200?text=Şəkil+Yoxdur'">
      <h3 style="margin: 10px 0 5px 0;">${item.title}</h3>
      <p style="color: #27ae60; font-weight: bold; font-size: 18px;">${item.price}</p>
      <p style="color: #666; font-size: 14px;">${item.description}</p>
      <p style="font-size: 13px; color: #888;">📞 ${item.phone}</p>
    </div>
  `).join('');
}

// "İlkin Bazanı Bərpa Et" Düyməsi Funksiyası
async function resetDatabase() {
  if (confirm("İlkin nümunə elanları bazaya bərpa etmək istəyirsiniz?")) {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        currentListings = data.listings;
        renderUI();
        alert("İlkin baza uğurla bərpa olundu!");
      }
    } catch (err) {
      alert("Bərpa zamanı xəta baş verdi.");
    }
  }
}
