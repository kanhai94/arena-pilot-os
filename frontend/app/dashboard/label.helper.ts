export type OrganizationType = 'SPORTS' | 'SCHOOL';

export const getUILabels = (orgType: OrganizationType) => {
  if (orgType === 'SCHOOL') {
    return {
      batch: 'Class',
      batchPlural: 'Classes',
      coach: 'Teacher',
      coachPlural: 'Teachers',
      plan: 'Fee Structure',
      planPlural: 'Fee Structures',
      subject: 'Subject',
      subjectPlural: 'Subjects',
      trainingMenu: 'Subjects',
      studentsMenu: 'Students',
      financeMenu: 'Payments',
      automationsMenu: 'Workflows',
      reportsMenu: 'Reports'
    };
  }

  return {
    batch: 'Batch',
    batchPlural: 'Batches',
    coach: 'Coach',
    coachPlural: 'Coaches',
    plan: 'Plans',
    planPlural: 'Plans',
    subject: 'Subject',
    subjectPlural: 'Subjects',
    trainingMenu: 'Training Grid',
    studentsMenu: 'Students',
    financeMenu: 'Payments',
    automationsMenu: 'Workflows',
    reportsMenu: 'Reports'
  };
};
