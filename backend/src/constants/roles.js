export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  ACADEMY_ADMIN: 'AcademyAdmin',
  COACH: 'Coach',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  VIEWER: 'Viewer'
};

export const ALL_ROLES = Object.values(ROLES);

export const TEAM_MEMBER_ROLES = [
  ROLES.COACH,
  ROLES.MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.VIEWER
];
