import React, { useEffect, useState } from 'react';
import {
  ArrowDownUp,
  BarChart3,
  Filter,
  Tags,
  CreditCard,
  Wallet,
} from 'lucide-react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

const highlights = [
  {
    icon: ArrowDownUp,
    title: 'Lançamentos de receitas e despesas',
    description:
      'Cadastre entradas e saídas manualmente; as vendas registradas entram automaticamente na lista.',
  },
  {
    icon: BarChart3,
    title: 'Resumo de receitas, despesas e saldo',
    description:
      'Acompanhe os totais do período selecionado em cartões de resumo.',
  },
  {
    icon: Filter,
    title: 'Filtros por período, tipo, origem e categoria',
    description:
      'Combine filtros e busca por texto para encontrar qualquer lançamento rapidamente.',
  },
  {
    icon: Tags,
    title: 'Categorias personalizáveis',
    description:
      'Crie, renomeie e ative ou desative categorias para classificar seus lançamentos.',
  },
  {
    icon: CreditCard,
    title: 'Baixa de vendas por gateway',
    description:
      'Marque vendas recebidas por gateway (ex.: InfinitePay) direto no módulo de Finanças.',
  },
];

const seenKey = (userId) => `finances_announcement_seen_${userId}`;

const FinancesAnnouncement = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (localStorage.getItem(seenKey(user.id)) !== 'true') {
      setIsOpen(true);
    }
  }, [user?.id]);

  const dismiss = () => {
    if (user?.id) {
      localStorage.setItem(seenKey(user.id), 'true');
    }
    setIsOpen(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Novo módulo de Finanças"
      onClose={dismiss}
      maxWidth="max-w-xl"
      testId="finances-announcement"
    >
      <div className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6 text-accent" aria-hidden="true" />
          </div>
          <p className="text-sm text-ink-soft leading-relaxed">
            Agora o sistema conta com um módulo completo de Finanças. Veja o que
            você pode fazer:
          </p>
        </div>

        <ul className="mt-5 space-y-4">
          {highlights.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                className="w-5 h-5 mt-0.5 text-accent shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-sm text-ink-soft leading-relaxed">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Entendi
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default FinancesAnnouncement;
