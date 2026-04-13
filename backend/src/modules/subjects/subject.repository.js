import { Class } from '../../models/class.model.js';
import { Subject } from '../../models/subject.model.js';
import { Teacher } from '../../models/teacher.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

const subjectPopulate = [
  { path: 'classId', select: '_id name section', options: { lean: true } },
  { path: 'teacherId', select: '_id name email phone', options: { lean: true } }
];

export const subjectRepository = {
  findClassById(tenantId, classId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Class.findOne({ _id: classId, tenantId: scopedTenantId }).lean();
  },

  findTeacherById(tenantId, teacherId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Teacher.findOne({ _id: teacherId, tenantId: scopedTenantId }).lean();
  },

  async createSubject(payload) {
    const created = await Subject.create(payload);
    return Subject.findById(created._id).populate(subjectPopulate).lean();
  },

  listSubjects(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subject.find({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).populate(subjectPopulate).lean();
  },

  findSubjectById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subject.findOne({ _id: id, tenantId: scopedTenantId }).populate(subjectPopulate).lean();
  },

  updateSubjectById(tenantId, id, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subject.findOneAndUpdate({ _id: id, tenantId: scopedTenantId }, { $set: updatePayload }, { new: true })
      .populate(subjectPopulate)
      .lean();
  },

  deleteSubjectById(tenantId, id) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Subject.findOneAndDelete({ _id: id, tenantId: scopedTenantId }).lean();
  }
};
