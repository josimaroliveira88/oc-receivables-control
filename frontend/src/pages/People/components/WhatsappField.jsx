import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  onlyDigits,
  isDigitsOnly,
  isWhatsAppOutOfPattern,
  maskWhatsApp,
} from '../../../utils/whatsapp';
import { fieldClass, inputLabelClass } from '../utils/peopleHelpers';

const WhatsappField = ({ value, onChange }) => {
  const display = isDigitsOnly(value) ? maskWhatsApp(value) : value || '';
  const outOfPattern = isWhatsAppOutOfPattern(value);

  return (
    <div className="mb-4">
      <label className={inputLabelClass}>WhatsApp</label>
      <input
        type="tel"
        value={display}
        onChange={(e) => onChange(onlyDigits(e.target.value))}
        className={fieldClass}
        placeholder="+55 (11) 99999-8888"
        inputMode="numeric"
      />
      {outOfPattern && (
        <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Número fora do padrão (código do país + DDD + número). Ex.: +55 (11)
            99999-8888. Você pode salvar mesmo assim.
          </p>
        </div>
      )}
    </div>
  );
};

export default WhatsappField;
