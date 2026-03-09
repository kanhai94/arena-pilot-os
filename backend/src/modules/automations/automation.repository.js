import mongoose from 'mongoose';
import { AutomationLog } from './automation.model.js';
import { StudentFee } from '../../models/studentFee.model.js';
import { Student } from '../../models/student.model.js';
import { FeePlan } from '../../models/feePlan.model.js';
import { Payment } from '../../models/payment.model.js';
import { Attendance } from '../../models/attendance.model.js';
import { Batch } from '../../models/batch.model.js';
import { Tenant } from '../../models/tenant.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const automationRepository = {
  async getTenantName(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const tenant = await Tenant.findOne({ _id: scopedTenantId }).select('name academyName').lean();
    return tenant?.name || tenant?.academyName || 'ArenaPilot Academy';
  },

  async getFeeReminderCandidates({ tenantId, dueByDate, studentIds = [], batchIds = [] }) {
    const scopedTenantId = resolveTenantId(tenantId);
    const match = {
      tenantId: scopedTenantId,
      status: 'active',
      nextDueDate: { $lte: dueByDate }
    };

    if (studentIds.length > 0) {
      match.studentId = { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'feeplans',
          localField: 'feePlanId',
          foreignField: '_id',
          as: 'feePlan'
        }
      },
      { $unwind: '$feePlan' },
      {
        $lookup: {
          from: 'students',
          let: { studentId: '$studentId', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$studentId'] }, { $eq: ['$tenantId', '$$tenantId'] }]
                }
              }
            },
            { $project: { _id: 1, name: 1, parentPhone: 1, email: 1, batchId: 1, status: 1 } }
          ],
          as: 'student'
        }
      },
      { $unwind: '$student' },
      ...(batchIds.length > 0
        ? [
            {
              $match: {
                'student.batchId': { $in: batchIds.map((id) => new mongoose.Types.ObjectId(id)) }
              }
            }
          ]
        : []),
      {
        $lookup: {
          from: 'batches',
          let: { batchId: '$student.batchId', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$batchId'] }, { $eq: ['$tenantId', '$$tenantId'] }]
                }
              }
            },
            { $project: { _id: 1, name: 1, centerName: 1 } }
          ],
          as: 'batch'
        }
      },
      {
        $lookup: {
          from: 'payments',
          let: { studentId: '$studentId', tenantId: '$tenantId', startDate: '$startDate' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$studentId', '$$studentId'] },
                    { $eq: ['$tenantId', '$$tenantId'] },
                    { $gte: ['$paymentDate', '$$startDate'] }
                  ]
                }
              }
            },
            { $group: { _id: null, totalPaid: { $sum: '$amountPaid' } } }
          ],
          as: 'paymentSummary'
        }
      },
      {
        $addFields: {
          totalPaid: { $ifNull: [{ $arrayElemAt: ['$paymentSummary.totalPaid', 0] }, 0] }
        }
      },
      { $project: { paymentSummary: 0 } },
      { $sort: { nextDueDate: 1 } }
    ];

    return StudentFee.aggregate(pipeline);
  },

  async getAbsenceCandidates({ tenantId, mode, days, date, batchIds = [] }) {
    const scopedTenantId = resolveTenantId(tenantId);
    const match = { tenantId: scopedTenantId, status: 'absent' };

    if (mode === 'today') {
      match.date = date;
    } else if (mode === 'streak') {
      match.date = { $gte: date.from, $lte: date.to };
    }

    if (batchIds.length > 0) {
      match.batchId = { $in: batchIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { studentId: '$studentId', batchId: '$batchId' },
          absentCount: { $sum: 1 },
          lastAttendanceDate: { $max: '$date' }
        }
      },
      ...(mode === 'streak' ? [{ $match: { absentCount: { $gte: days } } }] : []),
      {
        $lookup: {
          from: 'students',
          let: { studentId: '$_id.studentId', tenantId: scopedTenantId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$studentId'] }, { $eq: ['$tenantId', '$$tenantId'] }]
                }
              }
            },
            { $project: { _id: 1, name: 1, parentPhone: 1, email: 1, status: 1 } }
          ],
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'batches',
          let: { batchId: '$_id.batchId', tenantId: scopedTenantId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$batchId'] }, { $eq: ['$tenantId', '$$tenantId'] }]
                }
              }
            },
            { $project: { _id: 1, name: 1, centerName: 1 } }
          ],
          as: 'batch'
        }
      }
    ];

    return Attendance.aggregate(pipeline);
  },

  async listActiveStudents(tenantId, studentIds = []) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = { tenantId: scopedTenantId, status: 'active' };
    if (studentIds.length > 0) {
      filter._id = { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
    return Student.find(filter).select('_id name parentPhone email batchId').lean();
  },

  async getBatchesByIds(tenantId, batchIds) {
    const scopedTenantId = resolveTenantId(tenantId);
    if (!batchIds.length) return [];
    return Batch.find({ tenantId: scopedTenantId, _id: { $in: batchIds } }).select('_id name centerName').lean();
  },

  async createAutomationLog(payload) {
    return AutomationLog.create(payload);
  },

  async listAutomationLogs({ tenantId, page, limit }) {
    const scopedTenantId = resolveTenantId(tenantId);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AutomationLog.find({ tenantId: scopedTenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AutomationLog.countDocuments({ tenantId: scopedTenantId })
    ]);
    return { items, total };
  },

  async getFeePlanById(tenantId, feePlanId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return FeePlan.findOne({ _id: feePlanId, tenantId: scopedTenantId }).lean();
  },

  async sumPaymentsForStudent(tenantId, studentId, fromDate) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Payment.aggregate([
      { $match: { tenantId: scopedTenantId, studentId, paymentDate: { $gte: fromDate } } },
      { $group: { _id: null, totalPaid: { $sum: '$amountPaid' } } }
    ]);
  }
};
