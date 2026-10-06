require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'elan_mekani_secret_key_2026';

// 1. Təhlükəsizlik Middleware-ləri
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Rate Limiter (Spam əleyhinə)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Həddindən artıq sorğu göndərildi. Zəhmət olmasa bir qədər gözləyin." }
});
app.use('/api/', limiter);

// Statik fayllar
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// 3. Mongoose Sxemləri

// İstifadəçi (User) Sxemi
const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, "Ad və soyad mütləqdir"], trim: true },
  email: { 
    type: String, 
    required: [true, "E-poçt mütləqdir"], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { type: String, required: [true, "Şifrə mütləqdir"] },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Elan (Listing) Sxemi
const listingSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: ['car', 'animal'] },
  price: { type: String, required: true, trim: true },
  image: { type: String, default: "https://via.placeholder.com/500x300?text=Sekil+Yoxdur" },
  phone: { type: String, required: true, match: [/^[0-9]{10,15}$/, "Düzgün telefon nömrəsi daxil edin"] },
  description: { type: String, required: true, maxlength: 1000 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isTrash: { type: Boolean, default: false }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

// JWT Middleware (Token yoxlanması)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ success: false, message: "Giriş icazəsi yoxdur" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Keçərsiz və ya vaxtı keçmiş token" });
    req.user = user;
    next();
  });
};

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

// 6. AUTENTİFİKASİYA APİ-LƏRİ (JWT + BCRYPT)

// Qeydiyyat (Register)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Bütün xanaları doldurun!" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Bu e-poçt ünvanı artıq qeydiyyatdan keçib!" });
    }

    // Bcrypt ilə şifrənin həşlənməsi
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    await newUser.save();

    // JWT Token Generasiyası
    const token = jwt.sign(
      { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: "Qeydiyyat uğurla tamamlandı!",
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Giriş (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "E-poçt və şifrə daxil edilməlidir!" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: "E-poçt və ya şifrə yanlışdır!" });
    }

    // Bcrypt şifrə müqayisəsi
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "E-poçt və ya şifrə yanlışdır!" });
    }

    // JWT Token Generasiyası
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: "Giriş uğurludur!",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cari İstifadəçi Məlumatı (Me)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "İstifadəçi tapılmadı" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. ELAN APİ-LƏRİ

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

app.post('/api/listings', async (req, res) => {
  try {
    const { title, category, price, image, phone, description } = req.body;

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

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    await Listing.findOneAndUpdate({ id: listingId }, { isTrash: true });
    res.json({ success: true, message: "Elan zibil qutusuna atıldı" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/trash', async (req, res) => {
  try {
    const trash = await Listing.find({ isTrash: true });
    res.json({ success: true, trash });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/trash/restore/:id', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    await Listing.findOneAndUpdate({ id: listingId }, { isTrash: false });
    res.json({ success: true, message: "Elan bərpa olundu" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await Listing.deleteMany({});
    await Listing.insertMany(defaultListings);
    res.json({ success: true, listings: defaultListings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Təhlükəsiz Server ${PORT} portunda işləyir...`));
