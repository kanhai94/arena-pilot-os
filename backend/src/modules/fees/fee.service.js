import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { normalizeToUTCDate, addMonthsUTC, computeFeeMetrics } from './fee.utils.js';
import { paymentLogger } from '../../config/logger.js';
import { TenantContext } from '../../core/context/tenantContext.js';

export const createFeeService = (repository, dependencies = {}) => {
  const { tenantMetricsService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();
  const paymentModeToDb = {
    CASH: 'CASH',
    ONLINE: 'ONLINE',
    UPI: 'UPI'
  };

  const formatMonthKey = (dateValue) => {
    const date = new Date(dateValue);
    return date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).replace(' ', '-');
  };

  const summarizeDueStatus = (dueDate, asOfDate) => {
    const diffMs = normalizeToUTCDate(dueDate).getTime() - normalizeToUTCDate(asOfDate).getTime();
    const dueInDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (dueInDays < 0) {
      return {
        status: 'OVERDUE',
        dueInDays,
        badge: 'Overdue'
      };
    }

    if (dueInDays === 0) {
      return {
        status: 'PENDING',
        dueInDays,
        badge: 'Due today'
      };
    }

    return {
      status: 'PENDING',
      dueInDays,
      badge: `Due in ${dueInDays} day${dueInDays === 1 ? '' : 's'}`
    };
  };

  const buildPendingRows = async ({ asOfDate, search = '', studentId, classId, dueInDays, page = 1, limit = 200 }) => {
    const rowsPerPage = Math.max(limit, 200);
    const { rows } = await repository.getPendingStudentFeesBase(resolveTenantId(), page, rowsPerPage, search);

    const filtered = rows
      .flatMap((row) => {
        const currentDate = normalizeToUTCDate(asOfDate);
        const startDate = normalizeToUTCDate(row.startDate);
        const feePlanAmount = row.feePlan?.amount || row.totalAmount || 0;
        if (!feePlanAmount || !row.feePlan?.durationMonths) {
          return [];
        }

        const metrics = computeFeeMetrics({
          startDate: row.startDate,
          nextDueDate: row.nextDueDate,
          totalAmount: row.totalAmount,
          durationMonths: row.feePlan.durationMonths,
          totalPaid: row.totalPaid || 0,
          asOfDate: currentDate
        });

        const pendingCycles = Math.max(0, Math.ceil(metrics.pendingTillDate / feePlanAmount));
        const firstPendingCycle = Math.max(0, metrics.dueCycles - pendingCycles);

        return Array.from({ length: pendingCycles }).map((_, index) => {
          const dueDate = addMonthsUTC(startDate, firstPendingCycle + index);
          const dueInfo = summarizeDueStatus(dueDate, currentDate);
          return {
            id: `${row.student._id}-${formatMonthKey(dueDate)}`,
            studentId: row.student._id,
            student: row.student,
            classId: row.student.classId?._id || row.student.classId || null,
            amount: feePlanAmount,
            paymentDate: null,
            dueDate,
            status: dueInfo.status,
            paymentMode: null,
            transactionId: null,
            month: formatMonthKey(dueDate),
            paymentSource: 'system',
            referenceNote: null,
            badge: dueInfo.badge,
            dueInDays: dueInfo.dueInDays,
            monthlyFee: feePlanAmount,
            lastPayment: row.totalPaid || 0,
            pendingDues: metrics.overallPending
          };
        });
      })
      .filter((item) => {
        if (studentId && String(item.studentId) !== String(studentId)) {
          return false;
        }
        if (classId && String(item.classId || '') !== String(classId)) {
          return false;
        }
        if (Number.isFinite(dueInDays) && item.dueInDays > Number(dueInDays)) {
          return false;
        }
        return true;
      });

    return filtered;
  };

  const calculateStudentFeeStatus = async (studentFee, asOfDate) => {
    const tenantId = resolveTenantId();
    const paymentRows = await repository.sumPaymentsForStudent(tenantId, studentFee.studentId, studentFee.startDate);
    const totalPaid = paymentRows[0]?.totalPaid || 0;

    return computeFeeMetrics({
      startDate: studentFee.startDate,
      nextDueDate: studentFee.nextDueDate,
      totalAmount: studentFee.totalAmount,
      durationMonths: studentFee.feePlan.durationMonths,
      totalPaid,
      asOfDate
    });
  };

  const refreshStudentFeeDerivedState = async (studentFee) => {
    const tenantId = resolveTenantId();
    const asOfDate = new Date();
    const paymentRows = await repository.sumPaymentsForStudent(tenantId, studentFee.studentId, studentFee.startDate);
    const totalPaid = paymentRows[0]?.totalPaid || 0;

    const coveredCycles = Math.min(studentFee.feePlan.durationMonths, Math.floor(totalPaid / studentFee.totalAmount));
    const nextDueDate = addMonthsUTC(studentFee.startDate, coveredCycles);

    const metrics = computeFeeMetrics({
      startDate: studentFee.startDate,
      nextDueDate,
      totalAmount: studentFee.totalAmount,
      durationMonths: studentFee.feePlan.durationMonths,
      totalPaid,
      asOfDate
    });

    await repository.updateStudentFeeById(tenantId, studentFee._id, {
      nextDueDate,
      status: metrics.isCompleted ? 'inactive' : 'active'
    });

    await repository.updateStudentFeeStatus(tenantId, studentFee.studentId, metrics.overallPending === 0 ? 'paid' : 'pending');

    return metrics;
  };

  return {
    async createFeePlan(payload) {
      const tenantId = resolveTenantId();
      try {
        return await repository.createFeePlan({
          ...payload,
          tenantId,
          description: payload.description || null
        });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Fee plan already exists in tenant', StatusCodes.CONFLICT);
        }
        throw error;
      }
    },

    getFeePlans() {
      const tenantId = resolveTenantId();
      return repository.getFeePlans(tenantId);
    },

    async updateFeePlan(planId, payload) {
      const tenantId = resolveTenantId();
      try {
        const nextPayload = {
          ...payload,
          ...(payload.description === '' ? { description: null } : {})
        };

        const updated = await repository.updateFeePlanById(tenantId, planId, nextPayload);
        if (!updated) {
          throw new AppError('Fee plan not found', StatusCodes.NOT_FOUND);
        }
        return updated;
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError('Fee plan already exists in tenant', StatusCodes.CONFLICT);
        }
        throw error;
      }
    },

    async assignFeePlan(payload) {
      const tenantId = resolveTenantId();
      const [student, feePlan, existing] = await Promise.all([
        repository.findStudentById(tenantId, payload.studentId),
        repository.findFeePlanById(tenantId, payload.feePlanId),
        repository.findActiveStudentFeeByStudentId(tenantId, payload.studentId)
      ]);

      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      if (!feePlan) {
        throw new AppError('Fee plan not found', StatusCodes.NOT_FOUND);
      }

      if (existing) {
        throw new AppError('Active fee plan already assigned to this student', StatusCodes.CONFLICT);
      }

      const startDate = normalizeToUTCDate(payload.startDate);

      const studentFee = await repository.createStudentFee({
        tenantId,
        studentId: payload.studentId,
        feePlanId: payload.feePlanId,
        startDate,
        nextDueDate: startDate,
        totalAmount: feePlan.amount,
        status: 'active'
      });

      await repository.updateStudentFeeStatus(tenantId, payload.studentId, 'pending');
      await repository.updateStudentById(tenantId, payload.studentId, { monthlyFee: feePlan.amount });

      return studentFee;
    },

    async getStudentFeeStatus(studentId, asOfInput) {
      const tenantId = resolveTenantId();
      const studentFee = await repository.findActiveStudentFeeByStudentId(tenantId, studentId);
      if (!studentFee) {
        throw new AppError('No active fee assignment for student', StatusCodes.NOT_FOUND);
      }

      const feePlan = await repository.findFeePlanById(tenantId, studentFee.feePlanId);
      if (!feePlan) {
        throw new AppError('Linked fee plan not found', StatusCodes.NOT_FOUND);
      }

      const withPlan = { ...studentFee, feePlan };
      const asOfDate = asOfInput ? normalizeToUTCDate(asOfInput) : new Date();
      const metrics = await calculateStudentFeeStatus(withPlan, asOfDate);

      return {
        studentId,
        feePlan: {
          id: String(feePlan._id),
          name: feePlan.name,
          amount: feePlan.amount,
          durationMonths: feePlan.durationMonths
        },
        assignment: {
          id: String(studentFee._id),
          startDate: studentFee.startDate,
          nextDueDate: studentFee.nextDueDate,
          status: studentFee.status,
          totalAmount: studentFee.totalAmount
        },
        summary: metrics
      };
    },

    async recordPayment(recordedBy, payload) {
      const tenantId = resolveTenantId();
      const [student, studentFee] = await Promise.all([
        repository.findStudentById(tenantId, payload.studentId),
        repository.findActiveStudentFeeByStudentId(tenantId, payload.studentId)
      ]);

      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      if (!studentFee) {
        throw new AppError('No active fee assignment for student', StatusCodes.BAD_REQUEST);
      }

      const paymentDate = normalizeToUTCDate(payload.paymentDate);
      const dueDate = payload.dueDate ? normalizeToUTCDate(payload.dueDate) : studentFee.nextDueDate;
      const month = payload.month || formatMonthKey(dueDate);
      const existingMonthPayment = await repository.findPaymentByStudentAndMonth(tenantId, payload.studentId, month);
      if (existingMonthPayment) {
        throw new AppError('Payment already exists for this student and month', StatusCodes.CONFLICT);
      }

      const payment = await repository.createPayment({
        tenantId,
        studentId: payload.studentId,
        amountPaid: payload.amountPaid,
        month,
        paymentDate,
        dueDate,
        status: 'PAID',
        paymentMode: paymentModeToDb[payload.paymentMode] || payload.paymentMode,
        transactionId: payload.transactionId || null,
        referenceNote: payload.referenceNote || null,
        recordedBy
      });

      paymentLogger.info(
        {
          tenantId: String(tenantId),
          studentId: payload.studentId,
          paymentId: String(payment._id),
          amountPaid: payload.amountPaid,
          paymentMode: payload.paymentMode,
          source: 'manual'
        },
        'Manual payment recorded'
      );

      if (tenantMetricsService?.incrementPaymentsRecordedThisMonth) {
        await tenantMetricsService.incrementPaymentsRecordedThisMonth(String(tenantId), 1);
      }

      const feePlan = await repository.findFeePlanById(tenantId, studentFee.feePlanId);
      if (!feePlan) {
        throw new AppError('Linked fee plan not found', StatusCodes.NOT_FOUND);
      }

      const metrics = await refreshStudentFeeDerivedState({ ...studentFee, feePlan });

      return {
        payment,
        summary: metrics
      };
    },

    async paymentHistory(query) {
      const tenantId = resolveTenantId();
      const { studentId, status, classId, dueInDays, page, limit } = query;

      if (studentId) {
        const student = await repository.findStudentById(tenantId, studentId);
        if (!student) {
          throw new AppError('Student not found', StatusCodes.NOT_FOUND);
        }
      }

      const paidHistoryPromise = repository.listPayments(tenantId, {
        studentId,
        status: status === 'PAID' ? 'PAID' : undefined,
        classId,
        dueInDays,
        page,
        limit
      });
      const pendingRowsPromise =
        !status || status === 'PENDING' || status === 'OVERDUE'
          ? buildPendingRows({
              asOfDate: new Date(),
              studentId,
              classId,
              dueInDays,
              page,
              limit
            })
          : Promise.resolve([]);

      const [{ items: paidItems, total, }, pendingRows] = await Promise.all([paidHistoryPromise, pendingRowsPromise]);
      const paidRows = paidItems.map((item) => ({
        id: String(item._id),
        studentId: typeof item.studentId === 'object' ? String(item.studentId?._id || '') : String(item.studentId),
        student: item.studentId,
        amount: item.amountPaid,
        paymentDate: item.paymentDate,
        dueDate: item.dueDate,
        status: item.status,
        paymentMode: item.paymentMode,
        transactionId: item.transactionId,
        month: item.month,
        recordedBy: item.recordedBy || null
      }));

      const merged =
        status && status !== 'PAID'
          ? pendingRows.filter((item) => item.status === status)
          : status === 'PAID'
            ? paidRows
            : [...pendingRows, ...paidRows].sort(
                (a, b) => new Date(b.paymentDate || b.dueDate).getTime() - new Date(a.paymentDate || a.dueDate).getTime()
              );

      const totalPaid = paidRows.reduce((sum, item) => sum + item.amount, 0);
      return {
        items: merged,
        pagination: {
          page,
          limit,
          total: status === 'PAID' ? total : merged.length,
          totalPages: Math.max(1, Math.ceil((status === 'PAID' ? total : merged.length) / limit))
        },
        totalPaid
      };
    },

    async pendingFeesList(page, limit, search, asOfInput) {
      const tenantId = resolveTenantId();
      const asOfDate = asOfInput ? normalizeToUTCDate(asOfInput) : new Date();
      const { rows, total } = await repository.getPendingStudentFeesBase(tenantId, page, limit, search);

      const items = rows
        .map((row) => {
          const metrics = computeFeeMetrics({
            startDate: row.startDate,
            nextDueDate: row.nextDueDate,
            totalAmount: row.totalAmount,
            durationMonths: row.feePlan.durationMonths,
            totalPaid: row.totalPaid || 0,
            asOfDate
          });

          if (metrics.overallPending <= 0) {
            return null;
          }

          return {
            student: row.student,
            feePlan: {
              id: row.feePlan._id,
              name: row.feePlan.name,
              amount: row.feePlan.amount,
              durationMonths: row.feePlan.durationMonths
            },
            assignment: {
              id: row._id,
              startDate: row.startDate,
              nextDueDate: row.nextDueDate,
              status: row.status
            },
            summary: metrics
          };
        })
        .filter(Boolean);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    },

    async getFeeSummary() {
      const asOfDate = new Date();
      const pendingRows = await buildPendingRows({ asOfDate, limit: 500 });
      const currentMonth = formatMonthKey(asOfDate);
      const { items: paidThisMonthItems } = await repository.listPayments(resolveTenantId(), {
        status: 'PAID',
        page: 1,
        limit: 500
      });

      const currentMonthItems = paidThisMonthItems.filter((item) => item.month === currentMonth);
      const pendingTotal = pendingRows.reduce((sum, row) => sum + row.amount, 0);
      const paidThisMonth = currentMonthItems.reduce((sum, row) => sum + row.amountPaid, 0);
      const overdueStudentsCount = new Set(
        pendingRows.filter((row) => row.status === 'OVERDUE').map((row) => String(row.studentId))
      ).size;

      return {
        totalPendingFees: pendingTotal,
        paidThisMonth,
        overdueStudentsCount,
        totalPendingRows: pendingRows.length
      };
    },

    async sendReminders(payload) {
      const tenantId = resolveTenantId();
      const rows = await buildPendingRows({
        asOfDate: new Date(),
        classId: payload.classId,
        dueInDays: payload.dueInDays
      });

      const filteredRows = payload.status ? rows.filter((row) => row.status === payload.status) : rows;

      const deduped = new Map();
      for (const row of filteredRows) {
        const key = `${row.studentId}-${row.month}`;
        if (!deduped.has(key)) {
          deduped.set(key, row);
        }
      }

      const entries = Array.from(deduped.values());
      await Promise.all(
        entries.map((row) =>
          repository.createNotification({
            tenantId,
            studentId: row.studentId,
            phoneNumber: row.student.parentPhone,
            messageType: 'feeReminder',
            messageContent:
              payload.channel === 'email'
                ? `Fee reminder for ${row.month}. Amount due: ${row.amount}.`
                : `Fee reminder: ${row.amount} due for ${row.month}.`,
            status: 'queued'
          })
        )
      );

      return {
        queued: entries.length,
        channel: payload.channel
      };
    }
  };
};
