import { Student } from '../../models/student.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const studentRepository = {
  createStudent(payload) {
    return Student.create(payload);
  },

  findActiveDuplicateByIdentity(tenantId, normalizedName, normalizedParentPhone, rawName, rawParentPhone, excludeStudentId = null) {
    const filter = {
      tenantId,
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
    return Student.findOne({ _id: studentId, tenantId }).lean();
  },

  async findStudents({ tenantId, page, limit, search, status }) {
    const baseFilter = { tenantId };

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
    return Student.findOneAndUpdate(
      { _id: studentId, tenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  deactivateStudentById(tenantId, studentId) {
    return Student.findOneAndUpdate(
      { _id: studentId, tenantId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, lean: true }
    );
  }
};
