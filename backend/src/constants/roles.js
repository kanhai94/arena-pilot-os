export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  COACH: 'COACH',
  STAFF: 'STAFF',
  // Legacy aliases kept for backward compatibility across existing modules.
  ACADEMY_ADMIN: 'ADMIN',
  MANAGER: 'STAFF',
  ACCOUNTANT: 'STAFF',
  VIEWER: 'STAFF'
};

const LEGACY_TO_CANONICAL_ROLE = {
  SuperAdmin: ROLES.SUPER_ADMIN,
  AcademyAdmin: ROLES.ADMIN,
  Coach: ROLES.COACH,
  Manager: ROLES.STAFF,
  Accountant: ROLES.STAFF,
  Viewer: ROLES.STAFF,
  ADMIN: ROLES.ADMIN,
  COACH: ROLES.COACH,
  STAFF: ROLES.STAFF,
  SUPER_ADMIN: ROLES.SUPER_ADMIN
};

export const normalizeRole = (role) => {
  if (!role) {
    return null;
  }
  return LEGACY_TO_CANONICAL_ROLE[role] || null;
};

export const TENANT_ROLES = [ROLES.ADMIN, ROLES.COACH, ROLES.STAFF];
export const ALL_ROLES = [ROLES.SUPER_ADMIN, ...TENANT_ROLES];

export const TEAM_MEMBER_ROLES = [
  ROLES.ADMIN,
  ROLES.COACH,
  ROLES.STAFF
];
