const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// GET all students
router.get('/', async (req, res) => {
  try {
    const { search, department, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (department) query.department = department;

    const skip = (page - 1) * limit;
    const [students, total] = await Promise.all([
      Student.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Student.countDocuments(query)
    ]);

    res.json({ success: true, students, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET student by ID
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.id, isActive: true });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST register student
router.post('/register', upload.single('profileImage'), async (req, res) => {
  try {
    const { studentId, name, email, department, class: cls, faceDescriptor } = req.body;

    const existing = await Student.findOne({ $or: [{ studentId }, { email }] });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.studentId === studentId
          ? 'Student ID already exists'
          : 'Email already registered'
      });
    }

    let parsedDescriptor = [];
    if (faceDescriptor) {
      try { parsedDescriptor = JSON.parse(faceDescriptor); } catch (e) {}
    }

    const student = new Student({
      studentId,
      name,
      email,
      department,
      class: cls,
      faceDescriptor: parsedDescriptor,
      profileImage: req.file ? req.file.filename : ''
    });

    await student.save();
    res.status(201).json({ success: true, message: 'Student registered successfully', student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update student face descriptor
router.put('/:id/face', async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    const student = await Student.findOneAndUpdate(
      { studentId: req.params.id },
      { faceDescriptor },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Face data updated', student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE student (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { studentId: req.params.id },
      { isActive: false },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all face descriptors for recognition
router.get('/faces/all', async (req, res) => {
  try {
    const students = await Student.find(
      { isActive: true, faceDescriptor: { $exists: true, $ne: [] } },
      { studentId: 1, name: 1, department: 1, class: 1, faceDescriptor: 1 }
    );
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
