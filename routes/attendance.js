const express = require("express");
const router = express.Router();
// moment ko badal kar moment-timezone kiya taaki India (IST) ka sahi time aaye
const moment = require("moment-timezone");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Admin = require("../models/Admin");

// Ek constant define kar dete hain India timezone ke liye
const INDIA_TZ = "Asia/Kolkata";

// POST mark attendance
router.post("/mark", async (req, res) => {
  try {
    const { studentId, confidence, method } = req.body;

    const student = await Student.findOne({ studentId, isActive: true });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    // YAHAN BADLAAV KIYA: Ab ye server ke time ki jagah humesha IST date aur time lega
    const today = moment().tz(INDIA_TZ).format("YYYY-MM-DD");
    const time = moment().tz(INDIA_TZ).format("HH:mm:ss");

    // Check if already marked today
    const existing = await Attendance.findOne({ studentId, date: today });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for today",
        attendance: existing,
      });
    }

    // YAHAN BADLAAV KIYA: Late check karne ke liye bhi IST ka hour aur minute nikal rahe hain
    const nowIST = moment().tz(INDIA_TZ);
    const hour = nowIST.hour();
    const minute = nowIST.minute();
    const isLate = hour > 9 || (hour === 9 && minute > 30);

    const attendance = new Attendance({
      student: student._id,
      studentId: student.studentId,
      studentName: student.name,
      department: student.department,
      class: student.class,
      date: today,
      time,
      status: isLate ? "Late" : "Present",
      method: method || "Face Recognition",
      confidence: confidence || 0,
    });

    await attendance.save();
    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      attendance,
      student: {
        name: student.name,
        studentId: student.studentId,
        department: student.department,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for today",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET attendance records with filters
router.get("/", async (req, res) => {
  try {
    const {
      date,
      studentId,
      department,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;
    const query = {};

    if (date) query.date = date;
    if (studentId) query.studentId = studentId;
    if (department) query.department = department;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
    ]);

    res.json({
      success: true,
      records,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET today's attendance
router.get("/today", async (req, res) => {
  try {
    // YAHAN BADLAAV KIYA: Today ka data nikalte waqt bhi IST timezone check hoga
    const today = moment().tz(INDIA_TZ).format("YYYY-MM-DD");
    const records = await Attendance.find({ date: today }).sort({ time: -1 });
    const totalStudents = await Student.countDocuments({ isActive: true });

    res.json({
      success: true,
      records,
      stats: {
        present: records.filter((r) => r.status === "Present").length,
        late: records.filter((r) => r.status === "Late").length,
        total: records.length,
        totalStudents,
        absent: totalStudents - records.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET stats/dashboard
router.get("/stats/overview", async (req, res) => {
  try {
    // YAHAN BADLAAV KIYA: Dashboard filter ko bhi India time zone par set kar diya hai
    const today = moment().tz(INDIA_TZ).format("YYYY-MM-DD");
    const thisMonth = moment().tz(INDIA_TZ).format("YYYY-MM");

    const [todayRecords, monthRecords, totalStudents, weekRecords] =
      await Promise.all([
        Attendance.find({ date: today }),
        Attendance.find({ date: { $regex: `^${thisMonth}` } }),
        Student.countDocuments({ isActive: true }),
        Attendance.find({
          date: {
            $gte: moment()
              .tz(INDIA_TZ)
              .subtract(7, "days")
              .format("YYYY-MM-DD"),
            $lte: today,
          },
        }),
      ]);

    // Weekly chart data
    const weekDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = moment().tz(INDIA_TZ).subtract(i, "days").format("YYYY-MM-DD");
      const dayLabel = moment().tz(INDIA_TZ).subtract(i, "days").format("ddd");
      const count = weekRecords.filter((r) => r.date === d).length;
      weekDays.push({ date: d, day: dayLabel, count });
    }

    res.json({
      success: true,
      stats: {
        today: {
          present: todayRecords.filter((r) => r.status === "Present").length,
          late: todayRecords.filter((r) => r.status === "Late").length,
          total: todayRecords.length,
          absent: totalStudents - todayRecords.length,
        },
        month: {
          total: monthRecords.length,
          present: monthRecords.filter((r) => r.status === "Present").length,
          late: monthRecords.filter((r) => r.status === "Late").length,
        },
        totalStudents,
        weekChart: weekDays,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET student attendance report
router.get("/report/:studentId", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { studentId: req.params.studentId };
    if (startDate && endDate) query.date = { $gte: startDate, $lte: endDate };

    const records = await Attendance.find(query).sort({ date: -1 });
    const student = await Student.findOne({ studentId: req.params.studentId });

    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    res.json({
      success: true,
      student,
      records,
      summary: {
        total: records.length,
        present: records.filter((r) => r.status === "Present").length,
        late: records.filter((r) => r.status === "Late").length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE attendance record
router.delete("/:id", async (req, res) => {
  try {
    const record = await Attendance.findByIdAndDelete(req.params.id);
    if (!record)
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    res.json({ success: true, message: "Record deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
