import { Student } from '../../models/student.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const studentRepository = {
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
  }
};
