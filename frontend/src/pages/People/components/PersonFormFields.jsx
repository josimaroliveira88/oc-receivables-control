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
