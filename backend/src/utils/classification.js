const SORTABLE_PERSON_FIELDS = [
  'name',
  'whatsapp',
  'commonGroups',
  'instagram',
  'address',
  'isVip',
  'isDoterraMember',
  'isTeamMember',
  'createdAt',
  'updatedAt',
];

// Maps the frontend classification filter onto the isVip/isDoterraMember flags.
const classificationToFlags = (classification) => {
  switch (classification) {
    case 'vip':
      return { isVip: true, isDoterraMember: false };
    case 'member':
      return { isVip: false, isDoterraMember: true };
    case 'vip_member':
      return { isVip: true, isDoterraMember: true };
    case 'none':
      return { isVip: false, isDoterraMember: false };
    case 'team':
      return { isTeamMember: true };
    default:
      return null;
  }
};

export { SORTABLE_PERSON_FIELDS, classificationToFlags };
