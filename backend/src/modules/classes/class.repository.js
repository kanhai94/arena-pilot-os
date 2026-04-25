import mongoose from 'mongoose';
import { Class } from '../../models/class.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Student } from '../../models/student.model.js';
import { Subject } from '../../models/subject.model.js';
import { Teacher } from '../../models/teacher.model.js';
import { User } from '../../models/user.model.js';
import { ROLES } from '../../constants/roles.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

const mapTeacherIdentity = (teacher) => {
  if (!teacher) {
    return null;
  }

  if ('fullName' in teacher) {
    return {
      _id: String(teacher._id),
      name: teacher.fullName,
      email: teacher.email,
      phone: ''
    };
  }

  return {
    _id: String(teacher._id),
    name: teacher.name,
    email: teacher.email,
    phone: teacher.phone || ''
  };
};

const attachTeacherRefs = async (tenantId, classDocs) => {
  if (!classDocs.length) {
    return [];
  }

  const teacherIds = classDocs
    .map((item) => item.classTeacherId)
    .filter(Boolean)
    .map((value) => new mongoose.Types.ObjectId(String(value)));

  if (teacherIds.length === 0) {
    return classDocs.map((item) => ({ ...item, classTeacherId: null }));
  }

  const [teacherRows, staffRows] = await Promise.all([
    Teacher.find({ tenantId, _id: { $in: teacherIds } }).lean(),
    User.find({
      tenantId,
      _id: { $in: teacherIds },
      role: ROLES.STAFF,
      isActive: true
    })
      .select('_id fullName email')
      .lean()
  ]);

  const teacherById = new Map();
  for (const teacher of teacherRows) {
    teacherById.set(String(teacher._id), mapTeacherIdentity(teacher));
  }
  for (const staff of staffRows) {
    teacherById.set(String(staff._id), mapTeacherIdentity(staff));
  }

  return classDocs.map((item) => ({
    ...item,
    classTeacherId: item.classTeacherId ? teacherById.get(String(item.classTeacherId)) || null : null
  }));
};

export const classRepository = {
  createClass(payload) {
    return Class.create(payload);
  },

  async listClasses(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const classDocs = await Class.find({ tenantId: scopedTenantId })
      .sort({ createdAt: -1 })
      .lean();

    return attachTeacherRefs(scopedTenantId, classDocs);
  },

  async findClassById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    const classDoc = await Class.findOne({ _id: id, tenantId: scopedTenantId }).lean();
    if (!classDoc) {
      return null;
    }

    const [resolved] = await attachTeacherRefs(scopedTenantId, [classDoc]);
    return resolved || null;
  },

  findClassByNameAndSection(tenantId, name, section = '', excludeId = null) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = {
      tenantId: scopedTenantId,
      name: name.trim(),
      section: section.trim()
    };

    if (excludeId) {
      filter._id = { $ne: excludeId };
    }

    return Class.findOne(filter).lean();
  },

  async findTeacherById(tenantId, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const teacher = await Teacher.findOne({ _id: teacherId, tenantId: scopedTenantId }).lean();
    if (teacher) {
      return mapTeacherIdentity(teacher);
    }

    const staffMember = await User.findOne({
      _id: teacherId,
      tenantId: scopedTenantId,
      role: ROLES.STAFF,
      isActive: true
    })
      .select('_id fullName email')
      .lean();

    return mapTeacherIdentity(staffMember);
  },

  async assignTeacherToClass(tenantId, id, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const updated = await Class.findOneAndUpdate(
      { _id: id, tenantId: scopedTenantId },
      { $set: { classTeacherId: teacherId || null } },
      { new: true }
    )
      .lean();

    if (!updated) {
      return null;
    }

    const [resolved] = await attachTeacherRefs(scopedTenantId, [updated]);
    return resolved || null;
  },

  async updateClass(tenantId, id, payload) {
    const scopedTenantId = resolveTenantId(tenantId);
    const updated = await Class.findOneAndUpdate(
      { _id: id, tenantId: scopedTenantId },
      {
        $set: {
          name: payload.name,
          section: payload.section,
          scheduleDays: payload.scheduleDays,
          startTime: payload.startTime,
          endTime: payload.endTime
        }
      },
      { new: true }
    ).lean();

    if (!updated) {
      return null;
    }

    const [resolved] = await attachTeacherRefs(scopedTenantId, [updated]);
    return resolved || null;
  },

  countStudentsLinkedToClass(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.countDocuments({
      tenantId: scopedTenantId,
      classId
    });
  },

  async deleteClassById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    const existing = await Class.findOne({ _id: id, tenantId: scopedTenantId }).lean();
    if (!existing) {
      return null;
    }

    await Promise.all([
      Attendance.deleteMany({ tenantId: scopedTenantId, classId: id }),
      Subject.deleteMany({ tenantId: scopedTenantId, classId: id }),
      Class.deleteOne({ _id: id, tenantId: scopedTenantId })
    ]);

    return existing;
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
