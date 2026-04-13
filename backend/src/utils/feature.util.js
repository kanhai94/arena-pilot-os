const ORG_FEATURES = {
  SPORTS: {
    batches: true,
    coaches: true,
    training: true,
    classes: false,
    teachers: false,
    subjects: false
  },
  SCHOOL: {
    batches: false,
    coaches: false,
    training: false,
    classes: true,
    teachers: true,
    subjects: true
  }
};

export const getFeaturesByOrgType = (orgType) => {
  const normalizedOrgType = String(orgType || 'SPORTS').trim().toUpperCase();
  return ORG_FEATURES[normalizedOrgType] || ORG_FEATURES.SPORTS;
};
