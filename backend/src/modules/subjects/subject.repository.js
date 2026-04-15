import { Class } from '../../models/class.model.js';
import { Subject } from '../../models/subject.model.js';
import { Teacher } from '../../models/teacher.model.js';
import { User } from '../../models/user.model.js';
import { ROLES } from '../../constants/roles.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

const mapTeacherIdentity = (teacher) => {
  if (!teacher) return null;

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

const attachSubjectRelations = async (tenantId, subjectDocs) => {
  if (!subjectDocs.length) {
    return [];
  }

  const classIds = [...new Set(subjectDocs.map((item) => item.classId).filter(Boolean).map((value) => String(value)))];
  const teacherIds = [...new Set(subjectDocs.map((item) => item.teacherId).filter(Boolean).map((value) => String(value)))];

  const [classRows, teacherRows, staffRows] = await Promise.all([
    classIds.length
      ? Class.find({ tenantId, _id: { $in: classIds } }).select('_id name section').lean()
      : Promise.resolve([]),
    teacherIds.length
      ? Teacher.find({ tenantId, _id: { $in: teacherIds } }).lean()
      : Promise.resolve([]),
    teacherIds.length
      ? User.find({
          tenantId,
          _id: { $in: teacherIds },
          role: ROLES.STAFF,
          isActive: true
        })
          .select('_id fullName email')
          .lean()
      : Promise.resolve([])
  ]);

  const classById = new Map(classRows.map((row) => [String(row._id), row]));
  const teacherById = new Map();

  for (const teacher of teacherRows) {
    teacherById.set(String(teacher._id), mapTeacherIdentity(teacher));
  }

  for (const staff of staffRows) {
    teacherById.set(String(staff._id), mapTeacherIdentity(staff));
  }

  return subjectDocs.map((item) => ({
    ...item,
    classId: item.classId ? classById.get(String(item.classId)) || null : null,
    teacherId: item.teacherId ? teacherById.get(String(item.teacherId)) || null : null
  }));
};

export const subjectRepository = {
  findClassById(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.findOne({ _id: classId, tenantId: scopedTenantId }).lean();
  },

  findTeacherById(tenantId, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Promise.all([
      Teacher.findOne({ _id: teacherId, tenantId: scopedTenantId }).lean(),
      User.findOne({
        _id: teacherId,
        tenantId: scopedTenantId,
        role: ROLES.STAFF,
        isActive: true
      })
        .select('_id fullName email')
        .lean()
    ]).then(([teacher, staff]) => teacher || staff || null);
  },

  async createSubject(payload) {
    const scopedTenantId = resolveTenantId(payload.tenantId);
    const created = await Subject.create(payload);
    const subjectDoc = await Subject.findById(created._id).lean();
    const [resolved] = await attachSubjectRelations(scopedTenantId, subjectDoc ? [subjectDoc] : []);
    return resolved || null;
  },

  async listSubjects(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const subjectDocs = await Subject.find({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).lean();
    return attachSubjectRelations(scopedTenantId, subjectDocs);
  },

  async findSubjectById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    const subjectDoc = await Subject.findOne({ _id: id, tenantId: scopedTenantId }).lean();
    const [resolved] = await attachSubjectRelations(scopedTenantId, subjectDoc ? [subjectDoc] : []);
    return resolved || null;
  },

  async updateSubjectById(tenantId, id, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    const subjectDoc = await Subject.findOneAndUpdate({ _id: id, tenantId: scopedTenantId }, { $set: updatePayload }, { new: true }).lean();
    const [resolved] = await attachSubjectRelations(scopedTenantId, subjectDoc ? [subjectDoc] : []);
    return resolved || null;
  },

  deleteSubjectById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subject.findOneAndDelete({ _id: id, tenantId: scopedTenantId }).lean();
  }
};
