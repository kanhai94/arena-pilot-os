import { FeePlan } from '../../models/feePlan.model.js';
import { StudentFee } from '../../models/studentFee.model.js';
import { Payment } from '../../models/payment.model.js';
import { Student } from '../../models/student.model.js';

export const feeRepository = {
  createFeePlan(payload) {
    return FeePlan.create(payload);
  },

  getFeePlans(tenantId) {
    return FeePlan.find({ tenantId }).sort({ createdAt: -1 }).lean();
  },

  findFeePlanById(tenantId, feePlanId) {
    return FeePlan.findOne({ _id: feePlanId, tenantId }).lean();
  },

  updateFeePlanById(tenantId, feePlanId, updatePayload) {
    return FeePlan.findOneAndUpdate({ _id: feePlanId, tenantId }, { $set: updatePayload }, { new: true, lean: true });
  },

  findStudentById(tenantId, studentId) {
    return Student.findOne({ _id: studentId, tenantId, status: 'active' }).lean();
  },

  findActiveStudentFeeByStudentId(tenantId, studentId) {
    return StudentFee.findOne({ tenantId, studentId, status: 'active' }).lean();
  },

  createStudentFee(payload) {
    return StudentFee.create(payload);
  },

  updateStudentFeeById(tenantId, studentFeeId, updatePayload) {
    return StudentFee.findOneAndUpdate(
      { _id: studentFeeId, tenantId },
      { $set: updatePayload },
      { new: true, lean: true }
    );
  },

  sumPaymentsForStudent(tenantId, studentId, fromDate) {
    return Payment.aggregate([
      {
        $match: {
          tenantId,
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
    const filter = { tenantId, studentId };
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
      { $match: { tenantId, status: 'active' } },
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
            { $project: { _id: 1, name: 1, parentPhone: 1, status: 1 } }
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
    return Student.updateOne({ _id: studentId, tenantId }, { $set: { feeStatus } });
  }
};
