require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// 1. Təhlükəsizlik Middleware-ləri
app.use(helmet({
  contentSecurityPolicy: false // Xarici Unsplash və Placeholder şəkillərinə icazə vermək üçün
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Spam və DDoS-a Qarşı Rate Limiter (15 dəqiqədə maksimum 100 sorğu)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Həddindən artıq sorğu göndərildi. Zəhmət olmasa bir qədər gözləyin." }
});
app.use('/api/', limiter);

// Statik fayllar
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Gücləndirilmiş Mongoose Sxemi (Validation & Timestamps)
const listingSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { 
    type: String, 
    required: [true, "Elan başlığı mütləqdir"], 
    trim: true, 
    maxlength: [120, "Başlıq maksimum 120 simvol ola bilər"] 
  },
  category: { 
    type: String, 
    required: [true, "Kateqoriya mütləqdir"], 
    enum: ['car', 'animal'] 
  },
  price: { 
    type: String, 
    required: [true, "Qiymət mütləqdir"], 
    trim: true 
  },
  image: { 
    type: String, 
    default: "https://via.placeholder.com/500x300?text=Sekil+Yoxdur" 
  },
  phone: { 
    type: String, 
    required: [true, "Telefon nömrəsi mütləqdir"],
    match: [/^[0-9]{10,15}$/, "Düzgün telefon nömrəsi daxil edin"]
  },
  description: { 
    type: String, 
    required: [true, "Məzmun mütləqdir"], 
    maxlength: [1000, "Təsvir maksimum 1000 simvol ola bilər"] 
  },
  isTrash: { type: Boolean, default: false }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

// 4. İlkin Standart Elanlar
const defaultListings = [
  {
    id: 1,
    title: "[NÜMUNƏ] Simmental Cins İnək",
    category: "animal",
    price: "2,400 AZN",
    image: "Inek.png",
    phone: "994000000000",
    description: "Günlük 22 litr süd verir. Sağlamdır, bütün peyvəndləri olunub.",
    isTrash: false
  },
  {
    id: 2,
    title: "[NÜMUNƏ] Mercedes E260 (2012)",
    category: "car",
    price: "18,500 AZN",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500",
    phone: "994000000000",
    description: "İkinci əl, yaxşı vəziyyətdədir. Vuruğu yoxdur, mühərrik 2.2L dizel.",
    isTrash: false
  },
  {
    id: 3,
    title: "[NÜMUNƏ] Hyundai Elantra (2015)",
    category: "car",
    price: "16,200 AZN",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500",
    phone: "994000000000",
    description: "Səliqəli sürülüb, yürüşü orijinaldır. Şəhər içi çox qənaətcildir.",
    isTrash: false
  },
  {
    id: 4,
    title: "[NÜMUNƏ] Qoyun Sürüsü",
    category: "animal",
    price: "3,200 AZN",
    image: "Quzu.png",
    phone: "994000000000",
    description: "Yaylaqda otlayan sağlam qoyun sürüsü.",
    isTrash: false
  },
  {
    id: 5,
    title: "[NÜMUNƏ] Qaz",
    category: "animal",
    price: "Razılaşma yolu ilə",
    image: "Qaz.png",
    phone: "994000000000",
    description: "Qaz elanı üçün şəkil nümunəsi.",
    isTrash: false
  },
  {
    id: 6,
    title: "[NÜMUNƏ] Cins atlar",
    category: "animal",
    price: "1,200 AZN",
    image: "At.png",
    phone: "994000000000",
    description: "Cins atlar, alqı-satqısı.",
    isTrash: false
  }
];

// 5. MongoDB Bağlantısı
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('✅ MongoDB verilənlər bazasına təhlükəsiz qoşuldu!');
      const count = await Listing.countDocuments();
      if (count === 0) {
        await Listing.insertMany(defaultListings);
        console.log('📦 İlkin elanlar təhlükəsiz bazaya yazıldı!');
      }
    })
    .catch(err => console.error('❌ MongoDB bağlantı xətası:', err.message));
}

// 6. API Yolları (Endpoints)

// Bütün aktiv elanları gətir
app.get('/api/listings', async (req, res) => {
  try {
    let listings = await Listing.find({ isTrash: false }).sort({ createdAt: -1 });
    if (!listings || listings.length === 0) {
      await Listing.insertMany(defaultListings);
      listings = await Listing.find({ isTrash: false });
    }
    const trashCount = await Listing.countDocuments({ isTrash: true });
    res.json({ success: true, listings, trashCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, listings: defaultListings });
  }
});

// Yeni elan əlavə et (Avtomatik ID və Validation ilə)
app.post('/api/listings', async (req, res) => {
  try {
    const { title, category, price, image, phone, description } = req.body;

    // Avtomatik ID artımı
    const lastItem = await Listing.findOne().sort({ id: -1 });
    const newId = lastItem && lastItem.id ? lastItem.id + 1 : Date.now();

    const newListing = new Listing({
      id: newId,
      title,
      category,
      price,
      image: image || "https://via.placeholder.com/500x300?text=Sekil+Yoxdur",
      phone,
      description,
      isTrash: false
    });

    await newListing.save();
    res.status(201).json({ success: true, listing: newListing });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Elanı zibil qutusuna at
app.delete('/api/listings/:id', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    await Listing.findOneAndUpdate({ id: listingId }, { isTrash: true });
    res.json({ success: true, message: "Elan zibil qutusuna atıldı" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Zibil qutusundakı elanları gətir
app.get('/api/trash', async (req, res) => {
  try {
    const trash = await Listing.find({ isTrash: true });
    res.json({ success: true, trash });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Zibil qutusundan geri bərpa et
app.post('/api/trash/restore/:id', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    await Listing.findOneAndUpdate({ id: listingId }, { isTrash: false });
    res.json({ success: true, message: "Elan bərpa olundu" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// İlkin Bazanı Sıfırlayıb Bərpa Etmə
app.post('/api/reset', async (req, res) => {
  try {
    await Listing.deleteMany({});
    await Listing.insertMany(defaultListings);
    res.json({ success: true, listings: defaultListings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Əsas Səhifə (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serverin Başladılması
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Təhlükəsiz Server ${PORT} portunda işləyir...`));
