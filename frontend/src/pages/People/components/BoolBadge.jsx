import React from 'react';

const BoolBadge = ({ value }) => (
  <span
    className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
      value
        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    }`}
  >
    {value ? 'Sim' : 'Não'}
  </span>
);

export default BoolBadge;
