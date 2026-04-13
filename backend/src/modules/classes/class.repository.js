import mongoose from 'mongoose';
import { Class } from '../../models/class.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Student } from '../../models/student.model.js';
import { Teacher } from '../../models/teacher.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const classRepository = {
  createClass(payload) {
    return Class.create(payload);
  },

  listClasses(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.find({ tenantId: scopedTenantId })
      .sort({ createdAt: -1 })
      .populate({ path: 'classTeacherId', select: '_id name email phone', options: { lean: true } })
      .lean();
  },

  findClassById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.findOne({ _id: id, tenantId: scopedTenantId })
      .populate({ path: 'classTeacherId', select: '_id name email phone', options: { lean: true } })
      .lean();
  },

  findTeacherById(tenantId, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Teacher.findOne({ _id: teacherId, tenantId: scopedTenantId }).lean();
  },

  assignTeacherToClass(tenantId, id, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.findOneAndUpdate(
      { _id: id, tenantId: scopedTenantId },
      { $set: { classTeacherId: teacherId || null } },
      { new: true }
    )
      .populate({ path: 'classTeacherId', select: '_id name email phone', options: { lean: true } })
      .lean();
  },

  async syncClassStrength(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const strength = await Student.countDocuments({
      tenantId: scopedTenantId,
      classId,
      status: 'active'
    });

    await Class.updateOne({ _id: classId, tenantId: scopedTenantId }, { $set: { strength } });
    return strength;
  },

  listStudentsByClass(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.find({
      tenantId: scopedTenantId,
      classId,
      status: 'active'
    })
      .select('_id name rollNumber feeStatus status')
      .sort({ rollNumber: 1, name: 1 })
      .lean();
  },

  async getAttendanceStatsForStudents(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const scopedClassId = new mongoose.Types.ObjectId(String(classId));
    const rows = await Attendance.aggregate([
      {
        $match: {
          tenantId: scopedTenantId,
          classId: scopedClassId
        }
      },
      {
        $group: {
          _id: {
            studentId: '$studentId',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map();
    for (const row of rows) {
      const studentKey = String(row._id.studentId);
      const current = statsMap.get(studentKey) || { present: 0, absent: 0 };
      current[row._id.status] = row.count;
      statsMap.set(studentKey, current);
    }

    return statsMap;
  }
};
