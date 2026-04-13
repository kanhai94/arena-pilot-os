export type OrganizationType = 'SPORTS' | 'SCHOOL';

export const getUILabels = (orgType: OrganizationType) => {
  if (orgType === 'SCHOOL') {
    return {
      batch: 'Class',
      batchPlural: 'Classes',
      coach: 'Teacher',
      coachPlural: 'Teachers',
      subject: 'Subject',
      subjectPlural: 'Subjects',
      trainingMenu: 'Curriculum',
      studentsMenu: 'Students',
      financeMenu: 'Finance',
      automationsMenu: 'Automations',
      reportsMenu: 'Reports'
    };
  }

  return {
    batch: 'Batch',
    batchPlural: 'Batches',
    coach: 'Coach',
    coachPlural: 'Coaches',
    subject: 'Subject',
    subjectPlural: 'Subjects',
    trainingMenu: 'Training Grid',
    studentsMenu: 'Students',
    financeMenu: 'Finance',
    automationsMenu: 'Automations',
    reportsMenu: 'Reports'
  };
};
