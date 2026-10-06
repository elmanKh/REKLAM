const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 1. İlkin elan məlumatlarınız (defaultData)
const defaultData = {
  listings: [
    {
      id: 1,
      title: "[NÜMUNƏ] Simmental Cins İnək",
      category: "animal",
      price: "2,400 AZN",
      image: "Inek.png",
      phone: "994000000000",
      description: "Günlük 22 litr süd verir. Sağlamdır, bütün peyvəndləri olunub."
    },
    {
      id: 2,
      title: "[NÜMUNƏ] Mercedes E260 (2012)",
      category: "car",
      price: "18,500 AZN",
      image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500",
      phone: "994000000000",
      description: "İkinci əl, yaxşı vəziyyətdədir. Vuruğu yoxdur, mühərrik 2.2L dizel."
    },
    {
      id: 3,
      title: "[NÜMUNƏ] Hyundai Elantra (2015)",
      category: "car",
      price: "16,200 AZN",
      image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500",
      phone: "994000000000",
      description: "Səliqəli sürülüb, yürüşü orijinaldır. Şəhər içi çox qənaətcildir."
    },
    {
      id: 4,
      title: "[NÜMUNƏ] Qoyun Sürüsü",
      category: "animal",
      price: "3,200 AZN",
      image: "Quzu.png",
      phone: "994000000000",
      description: "Yaylaqda otlayan sağlam qoyun sürüsü."
    },
    {
      id: 5,
      title: "[NÜMUNƏ] Qaz",
      category: "animal",
      price: "Razılaşma yolu ilə",
      image: "Qaz.png",
      phone: "994000000000",
      description: "Qaz elanı üçün şəkil nümunəsi."
    },
    {
      id: 6,
      title: "[NÜMUNƏ] Cins atlar",
      category: "animal",
      price: "1,200 AZN",
      image: "At.png",
      phone: "994000000000",
      description: "Cins atlar, alqı-satqısı."
    }
  ],
  trash: []
};

// 2. MongoDB Bağlantı Linki (Yalnız Environment dəyişənindən oxunur)
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// 3. MongoDB Sxemi
const listingSchema = new mongoose.Schema({
  id: Number,
  title: String,
  category: String,
  price: String,
  image: String,
  phone: String,
  description: String
});

const Listing = mongoose.model('Listing', listingSchema);

// 4. Verilənlər bazasına qoşulma
if (!MONGO_URI) {
  console.error('❌ XƏTA: Render Environment-də MONGODB_URI tapılmadı!');
} else {
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('✅ MongoDB verilənlər bazasına uğurla qoşuldu!');
      const count = await Listing.countDocuments();
      if (count === 0) {
        await Listing.insertMany(defaultData.listings);
        console.log('📦 defaultData ilkin elanları MongoDB-yə yazıldı!');
      }
    })
    .catch(err => {
      console.error('❌ MongoDB bağlantı xətası:', err.message);
    });
}

// 5. API və Əsas Səhifə Yolları
app.get('/api/listings', async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings.length > 0 ? listings : defaultData.listings);
  } catch (error) {
    res.json(defaultData.listings);
  }
});

app.get('/', (req, res) => {
  res.send('REKLAM (Elan Məkanı) backend serveri uğurla işləyir! 🚀');
});

// 6. Port Tənzimləməsi
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server ${PORT} portunda işləyir...`);
});
