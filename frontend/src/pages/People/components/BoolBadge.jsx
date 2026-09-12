import React from 'react';
import { BOOL_BADGE_CLASSES } from '../../../utils/badgeStyles';

const BoolBadge = ({ value }) => (
  <span
    className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
      value ? BOOL_BADGE_CLASSES.true : BOOL_BADGE_CLASSES.false
    }`}
  >
    {value ? 'Sim' : 'Não'}
  </span>
);

export default BoolBadge;
