import { FeePlan } from '../../models/feePlan.model.js';
import { StudentFee } from '../../models/studentFee.model.js';
import { Payment } from '../../models/payment.model.js';
import { Student } from '../../models/student.model.js';
import { Notification } from '../../models/notification.model.js';
import { TenantContext } from '../../core/context/tenantContext.js';

const resolveTenantId = (tenantId = null) => TenantContext.requireTenantId(tenantId);

export const feeRepository = {
  createFeePlan(payload) {
    return FeePlan.create(payload);
  },

  getFeePlans(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return FeePlan.find({ tenantId: scopedTenantId }).sort({ createdAt: -1 }).lean();
  },

  findFeePlanById(tenantId, feePlanId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return FeePlan.findOne({ _id: feePlanId, tenantId: scopedTenantId }).lean();
  },

  updateFeePlanById(tenantId, feePlanId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return FeePlan.findOneAndUpdate({ _id: feePlanId, tenantId: scopedTenantId }, { $set: updatePayload }, { new: true, lean: true });
  },

  findStudentById(tenantId, studentId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.findOne({ _id: studentId, tenantId: scopedTenantId, status: 'active' })
      .populate({ path: 'classId', select: '_id name section', options: { lean: true } })
      .lean();
  },

  findActiveStudentFeeByStudentId(tenantId, studentId) {
    const scopedTenantId = resolveTenantId(tenantId);
    return StudentFee.findOne({ tenantId: scopedTenantId, studentId, status: 'active' }).lean();
  },

  createStudentFee(payload) {
    return StudentFee.create(payload);
  },

  updateStudentFeeById(tenantId, studentFeeId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return StudentFee.findOneAndUpdate(
      { _id: studentFeeId, tenantId: scopedTenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  sumPaymentsForStudent(tenantId, studentId, fromDate) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Payment.aggregate([
      {
        $match: {
          tenantId: scopedTenantId,
          studentId,
          paymentDate: { $gte: fromDate }
        }
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amountPaid' }
        }
      }
    ]);
  },

  createPayment(payload) {
    return Payment.create(payload);
  },

  async getPaymentHistory(tenantId, studentId, page, limit) {
    const scopedTenantId = resolveTenantId(tenantId);
    const filter = { tenantId: scopedTenantId, studentId };
    const skip = (page - 1) * limit;

    const [items, total, totals] = await Promise.all([
      Payment.find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'recordedBy', select: '_id fullName role', options: { lean: true } })
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([
        { $match: filter },
        { $group: { _id: null, totalPaid: { $sum: '$amountPaid' } } }
      ])
    ]);

    return {
      items,
      total,
      totalPaid: totals[0]?.totalPaid || 0
    };
  },

  async getPendingStudentFeesBase(tenantId, page, limit, search) {
    const scopedTenantId = resolveTenantId(tenantId);
    const skip = (page - 1) * limit;

    const studentMatch = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { parentPhone: { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    const pipeline = [
      { $match: { tenantId: scopedTenantId, status: 'active' } },
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
            { $match: studentMatch },
            { $project: { _id: 1, name: 1, email: 1, parentPhone: 1, status: 1, classId: 1, monthlyFee: 1 } }
          ],
          as: 'student'
        }
      },
      { $unwind: '$student' },
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
            {
              $group: {
                _id: null,
                totalPaid: { $sum: '$amountPaid' }
              }
            }
          ],
          as: 'paymentSummary'
        }
      },
      {
        $addFields: {
          totalPaid: {
            $ifNull: [{ $arrayElemAt: ['$paymentSummary.totalPaid', 0] }, 0]
          }
        }
      },
      {
        $project: {
          paymentSummary: 0
        }
      },
      { $sort: { nextDueDate: 1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          meta: [{ $count: 'total' }]
        }
      }
    ];

    const result = await StudentFee.aggregate(pipeline);
    const rows = result[0]?.rows || [];
    const total = result[0]?.meta?.[0]?.total || 0;

    return { rows, total };
  },

  updateStudentFeeStatus(tenantId, studentId, feeStatus) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.updateOne({ _id: studentId, tenantId: scopedTenantId }, { $set: { feeStatus } });
  },

  updateStudentById(tenantId, studentId, updatePayload) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Student.findOneAndUpdate(
      { _id: studentId, tenantId: scopedTenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  findPaymentByStudentAndMonth(tenantId, studentId, month) {
    const scopedTenantId = resolveTenantId(tenantId);
    return Payment.findOne({ tenantId: scopedTenantId, studentId, month }).lean();
  },

  async listPayments(tenantId, filters = {}) {
    const scopedTenantId = resolveTenantId(tenantId);
    const {
      studentId,
      status,
      classId,
      dueInDays,
      page = 1,
      limit = 50
    } = filters;
    const skip = (page - 1) * limit;
    const match = { tenantId: scopedTenantId };

    if (studentId) {
      match.studentId = studentId;
    }
    if (status) {
      match.status = status;
    }

    const studentPipeline = [];
    if (classId) {
      studentPipeline.push({ $match: { classId } });
    }

    if (Number.isFinite(dueInDays)) {
      const now = new Date();
      const dueCutoff = new Date(now);
      dueCutoff.setDate(dueCutoff.getDate() + Number(dueInDays));
      match.dueDate = { $lte: dueCutoff };
    }

    const [items, total] = await Promise.all([
      Payment.find(match)
        .sort({ dueDate: 1, paymentDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'studentId', select: '_id name email parentPhone classId monthlyFee', match: studentPipeline[0]?.$match, options: { lean: true }, populate: { path: 'classId', select: '_id name section', options: { lean: true } } })
        .populate({ path: 'recordedBy', select: '_id fullName role', options: { lean: true } })
        .lean(),
      Payment.countDocuments(match)
    ]);

    const filteredItems = items.filter((item) => item.studentId);

    return {
      items: filteredItems,
      total: classId ? filteredItems.length : total
    };
  },

  async getPaymentSummary(tenantId) {
    const scopedTenantId = resolveTenantId(tenantId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextMonthStart.setHours(0, 0, 0, 0);

    const [pendingRows, paidThisMonthRows, overdueStudentsRows] = await Promise.all([
      StudentFee.aggregate([
        { $match: { tenantId: scopedTenantId, status: 'active' } },
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
          $project: {
            totalAmount: 1,
            startDate: 1,
            nextDueDate: 1,
            durationMonths: '$feePlan.durationMonths',
            totalPaid: { $ifNull: [{ $arrayElemAt: ['$paymentSummary.totalPaid', 0] }, 0] }
          }
        }
      ]),
      Payment.aggregate([
        { $match: { tenantId: scopedTenantId, paymentDate: { $gte: monthStart, $lt: nextMonthStart } } },
        { $group: { _id: null, totalAmount: { $sum: '$amountPaid' } } }
      ]),
      Payment.aggregate([
        { $match: { tenantId: scopedTenantId, status: 'OVERDUE' } },
        { $group: { _id: '$studentId' } },
        { $count: 'total' }
      ])
    ]);

    return {
      pendingRows,
      paidThisMonth: paidThisMonthRows?.[0]?.totalAmount || 0,
      overdueStudentsCount: overdueStudentsRows?.[0]?.total || 0
    };
  },

  createNotification(payload) {
    return Notification.create(payload);
  },

  async findStudentsByDueStatus(tenantId, filters = {}) {
    const scopedTenantId = resolveTenantId(tenantId);
    const { status, classId, dueInDays } = filters;
    const paymentFilter = {};
    if (status) {
      paymentFilter.status = status;
    }
    if (Number.isFinite(dueInDays)) {
      const now = new Date();
      const dueCutoff = new Date(now);
      dueCutoff.setDate(dueCutoff.getDate() + Number(dueInDays));
      paymentFilter.dueDate = { $lte: dueCutoff };
    }

    const rows = await Payment.find({ tenantId: scopedTenantId, ...paymentFilter })
      .populate({
        path: 'studentId',
        select: '_id name email parentPhone classId',
        match: classId ? { classId } : {},
        options: { lean: true },
        populate: { path: 'classId', select: '_id name section', options: { lean: true } }
      })
      .sort({ dueDate: 1 })
      .lean();

    return rows.filter((row) => row.studentId);
  }
};
