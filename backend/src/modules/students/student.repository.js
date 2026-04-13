import { Student } from '../../models/student.model.js';
import { StudentFee } from '../../models/studentFee.model.js';
import { Payment } from '../../models/payment.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Notification } from '../../models/notification.model.js';
import { Class } from '../../models/class.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const studentRepository = {
  async getTenantOrganizationType(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const tenant = await Tenant.findOne({ _id: scopedTenantId }).select('organizationType').lean();
    return tenant?.organizationType || 'SPORTS';
  },

  createStudent(payload) {
    return Student.create(payload);
  },

  findActiveDuplicateByIdentity(tenantId, normalizedName, normalizedParentPhone, rawName, rawParentPhone, excludeStudentId = null) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = {
      tenantId: scopedTenantId,
      status: 'active',
      $or: [
        {
          normalizedName,
          normalizedParentPhone
        },
        {
          name: { $regex: `^${escapeRegex(rawName)}$`, $options: 'i' },
          parentPhone: rawParentPhone
        }
      ]
    };

    if (excludeStudentId) {
      filter._id = { $ne: excludeStudentId };
    }

    return Student.findOne(filter).lean();
  },

  findStudentById(tenantId, studentId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.findOne({ _id: studentId, tenantId: scopedTenantId }).lean();
  },

  findClassById(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.findOne({ _id: classId, tenantId: scopedTenantId }).lean();
  },

  findStudentByRollNumberInClass(tenantId, classId, rollNumber, excludeStudentId = null) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = {
      tenantId: scopedTenantId,
      classId,
      rollNumber: rollNumber.trim(),
      status: 'active'
    };

    if (excludeStudentId) {
      filter._id = { $ne: excludeStudentId };
    }

    return Student.findOne(filter).lean();
  },

  async syncClassStrength(tenantId, classId) {
    if (!classId) return 0;
    const scopedTenantId = resolveTenantId(tenantId);
    const strength = await Student.countDocuments({
      tenantId: scopedTenantId,
      classId,
      status: 'active'
    });

    await Class.updateOne({ _id: classId, tenantId: scopedTenantId }, { $set: { strength } });
    return strength;
  },

  async findStudents({ tenantId, page, limit, search, status }) {
    const scopedTenantId = resolveTenantId(tenantId);
    const baseFilter = { tenantId: scopedTenantId };

    if (status) {
      baseFilter.status = status;
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      baseFilter.$or = [
        { $text: { $search: search } },
        { parentPhone: { $regex: escapedSearch, $options: 'i' } },
        { name: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Student.find(baseFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'classId', select: '_id name section', options: { lean: true } })
        .lean(),
      Student.countDocuments(baseFilter)
    ]);

    return { items, total };
  },

  updateStudentById(tenantId, studentId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.findOneAndUpdate(
      { _id: studentId, tenantId: scopedTenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  deactivateStudentById(tenantId, studentId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.findOneAndUpdate(
      { _id: studentId, tenantId: scopedTenantId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, lean: true }
    );
  },

  async hardDeleteStudentById(tenantId, studentId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = { _id: studentId, tenantId: scopedTenantId };
    const existing = await Student.findOne(filter).lean();
    if (!existing) return null;

    await Promise.all([
      StudentFee.deleteMany({ tenantId: scopedTenantId, studentId }),
      Payment.deleteMany({ tenantId: scopedTenantId, studentId }),
      Attendance.deleteMany({ tenantId: scopedTenantId, studentId }),
      Notification.deleteMany({ tenantId: scopedTenantId, studentId })
    ]);

    await Student.deleteOne(filter);
    return existing;
  }
};
