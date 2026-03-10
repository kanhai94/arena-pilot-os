import { ROLES } from '../constants/roles.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../constants/permissions.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Tenant } from '../models/tenant.model.js';
import { Subscription } from '../models/subscription.model.js';
import { User } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';

const addYearsUTC = (date, years) => {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
};

export const ensureSuperAdminBootstrap = async () => {
  const email = (env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = (env.SUPER_ADMIN_PASSWORD || '').trim();
  const fullName = (env.SUPER_ADMIN_NAME || 'Super Admin').trim();

  if (!email || !password) {
    logger.warn('Super admin bootstrap skipped (SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD missing)');
    return;
  }

  // Ensure only the configured SUPER_ADMIN_EMAIL retains SuperAdmin role.
  const demotionResult = await User.updateMany(
    { role: ROLES.SUPER_ADMIN, email: { $ne: email } },
    {
      $set: {
        role: ROLES.ADMIN,
        permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.ADMIN]
      }
    }
  );
  if (demotionResult?.modifiedCount) {
    logger.info(
      { demotedCount: demotionResult.modifiedCount, superAdminEmail: email },
      'Demoted stale SuperAdmin accounts'
    );
  }

  const existingUser = await User.findOne({ email }).select('+passwordHash').lean();
  if (existingUser) {
    if (existingUser.role !== ROLES.SUPER_ADMIN) {
      await User.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            role: ROLES.SUPER_ADMIN,
            permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.SUPER_ADMIN],
            isActive: true
          }
        }
      );
      logger.info({ email }, 'Existing user elevated to SuperAdmin');
    } else {
      await User.updateOne(
        { _id: existingUser._id },
        { $set: { permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.SUPER_ADMIN], isActive: true } }
      );
      logger.info({ email }, 'Super admin already present');
    }
    return;
  }

  const superAdminTenantCode = `${env.ACADEMY_CODE_PREFIX.toLowerCase()}-00`;
  const now = new Date();
  let tenant = await Tenant.findOne({
    $or: [{ email }, { academyCode: superAdminTenantCode }]
  }).lean();

  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Platform Admin Tenant',
      academyCode: superAdminTenantCode,
      ownerName: fullName,
      academySize: null,
      requestedPlanName: 'Pro',
      email,
      subscriptionStatus: 'active',
      currentPlanId: null,
      planName: 'Pro',
      studentLimit: null,
      planStartDate: now,
      planEndDate: addYearsUTC(now, 10)
    });
  } else {
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $set: {
          academyCode: superAdminTenantCode,
          email,
          ownerName: fullName,
          academySize: null,
          requestedPlanName: 'Pro',
          planName: 'Pro',
          studentLimit: null
        }
      }
    );
    tenant = await Tenant.findOne({ _id: tenant._id }).lean();
  }

  const existingSubscription = await Subscription.findOne({ tenantId: tenant._id, status: { $in: ['trial', 'active'] } })
    .sort({ createdAt: -1 })
    .lean();

  if (!existingSubscription) {
    await Subscription.create({
      tenantId: tenant._id,
      planId: null,
      startDate: now,
      endDate: addYearsUTC(now, 10),
      status: 'active',
      autoRenew: false
    });
  }

  await Tenant.updateOne(
    { _id: tenant._id },
    {
      $set: {
        subscriptionStatus: 'active',
        planStartDate: now,
        planEndDate: addYearsUTC(now, 10)
      }
    }
  );

  const passwordHash = await hashPassword(password);

  await User.create({
    tenantId: tenant._id,
    fullName,
    email,
    passwordHash,
    role: ROLES.SUPER_ADMIN,
    permissions: ROLE_DEFAULT_PERMISSIONS[ROLES.SUPER_ADMIN],
    isActive: true
  });

  logger.info({ email }, 'Super admin bootstrap completed');
};
