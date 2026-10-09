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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: "Həddindən artıq sorğu göndərildi. Bir qədər gözləyin." }
});
app.use('/api/', limiter);

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Mongoose Modelləri
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { 
    type: String, 
    default: "https://api.dicebear.com/7.x/bottts/svg?seed=Fidan" 
  },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// KƏND TƏSƏRRÜFATI KATEQORİYASI ƏLAVƏ EDİLDİ
const listingSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['car', 'animal', 'farm'] },
  price: { type: String, required: true, trim: true },
  image: { type: String, default: "https://via.placeholder.com/500x300?text=Sekil+Yoxdur" },
  phone: { type: String, required: true },
  description: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isTrash: { type: Boolean, default: false }
}, { timestamps: true });

const Listing = mongoose.model('Listing', listingSchema);

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Zəhmət olmasa əvvəlcə daxil olun!" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Seansın vaxtı bitib, yenidən daxil olun." });
    }
    req.user = user;
    next();
  });
};

const defaultListings = [
  { id: 1, title: "[NÜMUNƏ] Simmental Cins İnək", category: "animal", price: "2,400 AZN", image: "Inek.png", phone: "994000000000", description: "Günlük 22 litr süd verir.", isTrash: false },
  { id: 2, title: "[NÜMUNƏ] Mercedes E260 (2012)", category: "car", price: "18,500 AZN", image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500", phone: "994000000000", description: "İkinci əl, yaxşı vəziyyətdədir.", isTrash: false },
  { id: 3, title: "[NÜMUNƏ] Hyundai Elantra (2015)", category: "car", price: "16,200 AZN", image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500", phone: "994000000000", description: "Səliqəli sürülüb, yürüşü orijinaldır.", isTrash: false },
  { id: 4, title: "[NÜMUNƏ] Qoyun Sürüsü", category: "animal", price: "3,200 AZN", image: "Quzu.png", phone: "994000000000", description: "Yaylaqda otlayan sağlam qoyun sürüsü.", isTrash: false },
  { id: 5, title: "[NÜMUNƏ] Qaz", category: "animal", price: "Razılaşma yolu ilə", image: "Qaz.png", phone: "994000000000", description: "Qaz elanı üçün şəkil nümunəsi.", isTrash: false },
  { id: 6, title: "[NÜMUNƏ] Cins atlar", category: "animal", price: "1,200 AZN", image: "At.png", phone: "994000000000", description: "Cins atlar, alqı-satqısı.", isTrash: false },
  { id: 7, title: "[NÜMUNƏ] Ördəklər", category: "animal", price: "Razılaşma yolu ilə", image: "Ducks.png", phone: "994000000000", description: "Təbii şəraitdə çay kənarında böyümüş ördəklər.", isTrash: false },
  { id: 8, title: "[NÜMUNƏ] Təbii Quba Alması (1 Tonn)", category: "farm", price: "0.80 AZN/kg", image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500", phone: "994000000000", description: "Təbii, dərmansız bağ alması.", isTrash: false }
];

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(async () => {
      console.log('✅ MongoDB bazasına təhlükəsiz qoşuldu!');
      const count = await Listing.countDocuments();
      if (count === 0) {
        await Listing.insertMany(defaultListings);
      }
    })
    .catch(err => console.error('❌ MongoDB xətası:', err.message));
}

// Auth API-ləri
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Bütün xanaları doldurun!" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Bu e-poçt artıq qeydiyyatdan keçib!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    const newUser = new User({ 
      name, 
      email: email.toLowerCase(), 
      password: hashedPassword,
      avatar: userAvatar
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id, name: newUser.name, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: "Qeydiyyat uğurla tamamlandı!",
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email, avatar: newUser.avatar }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: "E-poçt və ya şifrə yanlışdır!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "E-poçt və ya şifrə yanlışdır!" });

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      message: "Giriş uğurludur!",
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "İstifadəçi tapılmadı" });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Listing API-ləri
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
    res.status(500).json({ success: false, message: error.message, listings: defaultListings, trashCount: 0 });
  }
});

app.post('/api/listings', authenticateToken, async (req, res) => {
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
      userId: req.user.id,
      isTrash: false
    });

    await newListing.save();
    res.status(201).json({ success: true, listing: newListing });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Zibil qutusuna atma (Soft Delete)
app.delete('/api/listings/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const listing = await Listing.findOne({ id: listingId });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Elan tapılmadı!" });
    }

    if (!listing.userId) {
      return res.status(403).json({ success: false, message: "🚫 Nümunə/Sistem elanlarını silmək icazəniz yoxdur!" });
    }

    if (listing.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "🚫 Bu elan sizə aid deyil! Yalnız öz paylaşdığınız elanları silə bilərsiniz." });
    }

    listing.isTrash = true;
    await listing.save();

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

app.post('/api/trash/restore/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    await Listing.findOneAndUpdate({ id: listingId }, { isTrash: false });
    res.json({ success: true, message: "Elan bərpa olundu" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// HƏMİŞƏLİK SİLMƏ (HARD DELETE)
app.delete('/api/trash/:id', authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const listing = await Listing.findOne({ id: listingId });

    if (!listing) {
      return res.status(404).json({ success: false, message: "Elan tapılmadı!" });
    }

    if (!listing.userId) {
      return res.status(403).json({ success: false, message: "🚫 Nümunə elanları həmişəlik silə bilməzsiniz!" });
    }

    if (listing.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "🚫 Bu elan sizə aid deyil!" });
    }

    await Listing.deleteOne({ id: listingId });

    res.json({ success: true, message: "Elan bazadan həmişəlik silindi!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// BAZANI SIFIRLAMA
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
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ${PORT} portunda işləyir...`));
