import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../errors/appError.js';
import { normalizeToUTCDate, addMonthsUTC, computeFeeMetrics } from './fee.utils.js';
import { paymentLogger } from '../../config/logger.js';
import { TenantContext } from '../../core/context/tenantContext.js';

export const createFeeService = (repository, dependencies = {}) => {
  const { tenantMetricsService } = dependencies;
  const resolveTenantId = () => TenantContext.requireTenantId();

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

      const payment = await repository.createPayment({
        tenantId,
        studentId: payload.studentId,
        amountPaid: payload.amountPaid,
        paymentDate,
        paymentMode: payload.paymentMode,
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

    async paymentHistory(studentId, page, limit) {
      const tenantId = resolveTenantId();
      const student = await repository.findStudentById(tenantId, studentId);
      if (!student) {
        throw new AppError('Student not found', StatusCodes.NOT_FOUND);
      }

      const { items, total, totalPaid } = await repository.getPaymentHistory(tenantId, studentId, page, limit);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
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
    }
  };
};
