import React from 'react';
import { fieldClass } from '../utils/peopleHelpers';

const SimNaoSelect = ({ value, onChange, id }) => (
  <select
    id={id}
    value={value ? 'true' : 'false'}
    onChange={(e) => onChange(e.target.value === 'true')}
    className={fieldClass}
  >
    <option value="false">Não</option>
    <option value="true">Sim</option>
  </select>
);

export default SimNaoSelect;
