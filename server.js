// QRShare - Node.js + Express File Sharing with QR Codes
// Install dependencies: npm install express multer qrcode mongoose dotenv cors jsonwebtoken bcryptjs

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {})
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String
});
const User = mongoose.model('User', UserSchema);

// File Schema
const FileSchema = new mongoose.Schema({
    filename: String,
    filePath: String,
    qrCodeUrl: String
});
const File = mongoose.model('File', FileSchema);

// Multer Storage (Local)
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Default Route
app.get('/', (req, res) => {
    res.send('<h1>QRShare API is Running</h1>');
});

//Users find
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }); // Exclude passwords
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

//Users emails
// app.get('/emails', async (req, res) => {
//     try {
//         const emails = await User.find({}, { email: 1, _id: 0 }); // Only show emails
//         res.json(emails);
//     } catch (error) {
//         res.status(500).json({ error: 'Failed to retrieve users' });
//     }
// });
// User Registration
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.json({ message: 'User registered successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Upload File & Generate QR Code
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const filePath = path.join(uploadDir, req.file.filename);
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        const qrCodeUrl = await QRCode.toDataURL(fileUrl);
        const newFile = new File({ filename: req.file.originalname, filePath, qrCodeUrl });
        await newFile.save();
        res.json({ message: 'File uploaded!', fileUrl, qrCodeUrl });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));