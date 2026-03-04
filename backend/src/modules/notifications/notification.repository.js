import { Notification } from '../../models/notification.model.js';
import { Student } from '../../models/student.model.js';
import { StudentFee } from '../../models/studentFee.model.js';

export const notificationRepository = {
  createNotification(payload) {
    return Notification.create(payload);
  },

  findNotificationById(notificationId, tenantId = null) {
    const filter = { _id: notificationId };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return Notification.findOne(filter).lean();
  },

  markNotificationSent(notificationId, tenantId = null) {
    const filter = { _id: notificationId };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return Notification.findOneAndUpdate(
      filter,
      { $set: { status: 'sent', lastError: null, failedAt: null } },
      { new: true, lean: true }
    );
  },

  markNotificationFailed(notificationId, errorMessage = 'Unknown processing error', tenantId = null) {
    const filter = { _id: notificationId };
    if (tenantId) {
      filter.tenantId = tenantId;
    }
    return Notification.findOneAndUpdate(
      filter,
      {
        $set: { status: 'failed', lastError: String(errorMessage).slice(0, 500), failedAt: new Date() },
        $inc: { retryCount: 1 }
      },
      { new: true, lean: true }
    );
  },

  async getNotificationLogs({ tenantId, page, limit, status, messageType }) {
    const filter = { tenantId };

    if (status) {
      filter.status = status;
    }

    if (messageType) {
      filter.messageType = messageType;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'studentId', select: '_id name parentPhone', options: { lean: true } })
        .lean(),
      Notification.countDocuments(filter)
    ]);

    return { items, total };
  },

  getStudentsByIds(tenantId, studentIds) {
    return Student.find({ _id: { $in: studentIds }, tenantId, status: 'active' })
      .select('_id name parentPhone feeStatus')
      .lean();
  },

  getAllActiveStudents(tenantId) {
    return Student.find({ tenantId, status: 'active' }).select('_id name parentPhone feeStatus').lean();
  },

  async getPendingFeeCandidates(tenantId, studentId = null) {
    const match = { tenantId, status: 'active' };

    if (studentId) {
      match.studentId = studentId;
    }

    const rows = await StudentFee.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'students',
          let: { sid: '$studentId', tid: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$sid'] }, { $eq: ['$tenantId', '$$tid'] }, { $eq: ['$status', 'active'] }]
                }
              }
            },
            { $project: { _id: 1, name: 1, parentPhone: 1 } }
          ],
          as: 'student'
        }
      },
      { $unwind: '$student' },
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
          from: 'payments',
          let: { sid: '$studentId', tid: '$tenantId', start: '$startDate' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$studentId', '$$sid'] },
                    { $eq: ['$tenantId', '$$tid'] },
                    { $gte: ['$paymentDate', '$$start'] }
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
          totalPaid: {
            $ifNull: [{ $arrayElemAt: ['$paymentSummary.totalPaid', 0] }, 0]
          }
        }
      },
      {
        $project: {
          paymentSummary: 0
        }
      }
    ]);

    return rows;
  }
};
