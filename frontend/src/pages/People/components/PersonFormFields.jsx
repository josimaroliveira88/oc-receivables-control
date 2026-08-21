import React from 'react';
import WhatsappField from './WhatsappField';
import SimNaoSelect from './SimNaoSelect';
import { fieldClass, inputLabelClass } from '../utils/peopleHelpers';

const PersonFormFields = ({ values, onChange }) => {
  return (
    <>
      <div className="mb-4">
        <label className={inputLabelClass}>Nome</label>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          required
          className={fieldClass}
          placeholder="Digite o nome"
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass}>Grupos em comum</label>
        <input
          type="text"
          value={values.commonGroups}
          onChange={(e) => onChange('commonGroups', e.target.value)}
          maxLength={255}
          className={fieldClass}
          placeholder="Ex.: Grupo do WhatsApp, vizinho, família..."
        />
      </div>

      <WhatsappField
        value={values.whatsapp}
        onChange={(v) => onChange('whatsapp', v)}
      />

      <div className="mb-4">
        <label className={inputLabelClass}>Instagram</label>
        <input
          type="text"
          value={values.instagram}
          onChange={(e) => onChange('instagram', e.target.value)}
          maxLength={255}
          className={fieldClass}
          placeholder="https://instagram.com/usuario"
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass}>Endereço</label>
        <input
          type="text"
          value={values.address}
          onChange={(e) => onChange('address', e.target.value)}
          maxLength={500}
          className={fieldClass}
          placeholder="Digite o endereço completo"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="person-self"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
        >
          <input
            id="person-self"
            type="checkbox"
            checked={values.isSelf}
            onChange={(e) => onChange('isSelf', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Esta pessoa sou eu
        </label>
      </div>

      <div className="mb-4">
        <label className={inputLabelClass} htmlFor="person-vip">
          Grupo VIP
        </label>
        <SimNaoSelect
          id="person-vip"
          value={values.isVip}
          onChange={(v) => onChange('isVip', v)}
        />
      </div>

      <div className="mb-4">
        <label className={inputLabelClass} htmlFor="person-member">
          Cadastrado/Membro doTERRA
        </label>
        <SimNaoSelect
          id="person-member"
          value={values.isDoterraMember}
          onChange={(v) => onChange('isDoterraMember', v)}
        />
      </div>
    </>
  );
};

export default PersonFormFields;
