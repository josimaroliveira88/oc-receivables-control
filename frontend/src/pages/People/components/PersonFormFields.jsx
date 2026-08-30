import React from 'react';
import WhatsappField from './WhatsappField';
import SimNaoSelect from './SimNaoSelect';
import {
  fieldClass,
  inputLabelClass,
  maskBirthday,
} from '../utils/peopleHelpers';

const PersonFormFields = ({ values, onChange, showSelfCheckbox = true }) => {
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
        <label className={inputLabelClass} htmlFor="person-birthday">
          Aniversário
        </label>
        <input
          id="person-birthday"
          type="text"
          value={values.birthday ?? ''}
          onChange={(e) => onChange('birthday', maskBirthday(e.target.value))}
          maxLength={5}
          inputMode="numeric"
          className={fieldClass}
          placeholder="DD/MM"
          aria-describedby="person-birthday-hint"
        />
        <p
          id="person-birthday-hint"
          className="mt-1 text-xs text-gray-500 dark:text-gray-400"
        >
          Dia e mês do aniversário (ex.: 15/08)
        </p>
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
        <label className={inputLabelClass}>Observação</label>
        <textarea
          value={values.observacao ?? ''}
          onChange={(e) => onChange('observacao', e.target.value)}
          rows={4}
          maxLength={2000}
          className={fieldClass}
          placeholder="Informações gerais sobre o cliente (até 2000 caracteres)"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {(values.observacao ?? '').length}/2000
        </p>
      </div>

      {showSelfCheckbox && (
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
      )}

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

      <div className="mb-4">
        <label className={inputLabelClass} htmlFor="person-team">
          Equipe
        </label>
        <SimNaoSelect
          id="person-team"
          value={values.isTeamMember}
          onChange={(v) => onChange('isTeamMember', v)}
        />
      </div>
    </>
  );
};

export default PersonFormFields;
