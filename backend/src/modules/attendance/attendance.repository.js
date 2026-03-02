import { Attendance } from '../../models/attendance.model.js';
import { Batch } from '../../models/batch.model.js';
import { Student } from '../../models/student.model.js';

export const attendanceRepository = {
  findBatchById(tenantId, batchId, coachId = null) {
    const filter = { _id: batchId, tenantId, status: 'active' };
    if (coachId) {
      filter.coachId = coachId;
    }
    return Batch.findOne(filter).lean();
  },

  findStudentsInBatch(tenantId, batchId, studentIds) {
    return Student.find({ _id: { $in: studentIds }, tenantId, batchId, status: 'active' })
      .select('_id name parentPhone')
      .lean();
  },

  bulkUpsertAttendance(operations) {
    return Attendance.bulkWrite(operations, { ordered: false });
  },

  async getAttendanceByDate({ tenantId, date, batchId, coachId, page, limit }) {
    const match = { tenantId, date };

    if (batchId) {
      match.batchId = batchId;
    }

    if (coachId) {
      const coachBatches = await Batch.find({ tenantId, coachId, status: 'active' }).select('_id').lean();
      const coachBatchIds = coachBatches.map((batch) => batch._id);
      match.batchId = batchId ? batchId : { $in: coachBatchIds };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Attendance.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'studentId', select: '_id name parentPhone status', options: { lean: true } })
        .populate({ path: 'batchId', select: '_id name sportType coachId', options: { lean: true } })
        .populate({ path: 'markedBy', select: '_id fullName email role', options: { lean: true } })
        .lean(),
      Attendance.countDocuments(match)
    ]);

    return { items, total };
  },

  async getStudentAttendanceStats({ tenantId, studentId, fromDate, toDate, coachId }) {
    const match = { tenantId, studentId };

    if (fromDate || toDate) {
      match.date = {};
      if (fromDate) {
        match.date.$gte = fromDate;
      }
      if (toDate) {
        match.date.$lte = toDate;
      }
    }

    if (coachId) {
      const coachBatches = await Batch.find({ tenantId, coachId, status: 'active' }).select('_id').lean();
      const coachBatchIds = coachBatches.map((batch) => batch._id);
      match.batchId = { $in: coachBatchIds };
    }

    const [rows, total] = await Promise.all([
      Attendance.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Attendance.countDocuments(match)
    ]);

    const present = rows.find((row) => row._id === 'present')?.count || 0;
    const absent = rows.find((row) => row._id === 'absent')?.count || 0;

    return {
      studentId,
      total,
      present,
      absent,
      attendancePercentage: total === 0 ? 0 : Number(((present / total) * 100).toFixed(2))
    };
  }
};
