import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  LayoutDashboard,
  BarChart3,
  Users,
  ClipboardList,
  DollarSign,
  Navigation,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const steps = [
  {
    title: 'Bem-vindo ao Controle de Recebíveis!',
    description:
      'Vamos conhecer as principais funcionalidades do sistema em apenas alguns passos. Este tutorial rápido vai te mostrar como gerenciar pessoas, pedidos e recebíveis.',
    icon: GraduationCap,
    route: null,
  },
  {
    title: 'Indicadores do Dashboard',
    description:
      'Os três cards de KPI mostram de forma clara: total pendente (em vermelho), total quitado (em verde) e os recebimentos do mês atual (em azul).',
    icon: LayoutDashboard,
    route: '/',
  },
  {
    title: 'Gráficos e Exportação',
    description:
      'O gráfico de barras compara itens pendentes com pagamentos realizados por pessoa. Use o botão "Exportar para Excel" para gerar um relatório completo com 4 planilhas.',
    icon: BarChart3,
    route: null,
  },
  {
    title: 'Gerenciamento de Pessoas',
    description:
      'Cadastre clientes, fornecedores ou qualquer pessoa envolvida nos seus pedidos. Aqui você adiciona, edita e remove contatos com facilidade.',
    icon: Users,
    route: '/people',
  },
  {
    title: 'Criação de Pedidos',
    description:
      'Crie pedidos com itens dinâmicos. Cada item pode ter um valor e ser atribuído a uma pessoa diferente. O valor total é calculado automaticamente em centavos para evitar erros de arredondamento.',
    icon: ClipboardList,
    route: '/orders',
  },
  {
    title: 'Registro de Pagamentos',
    description:
      'Registre pagamentos contra pedidos. O sistema atualiza automaticamente o status: Pendente → Parcial → Quitado. Pagamentos acima do valor pendente são rejeitados.',
    icon: DollarSign,
    route: '/receivables',
  },
  {
    title: 'Navegação e Tema',
    description:
      'Use o menu superior (ou inferior no celular) para alternar entre as páginas. O botão de sol/lua alterna entre modo claro e escuro. Seu nome de usuário aparece no topo.',
    icon: Navigation,
    route: null,
  },
  {
    title: 'Tudo Pronto!',
    description:
      'Agora você já conhece o básico para usar o sistema. Refaça este tutorial quando quiser clicando no botão de ajuda no menu superior.',
    icon: CheckCircle,
    route: null,
  },
];

const OnboardingTour = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const showOnboarding = localStorage.getItem('show_onboarding');
    const onboardingComplete = localStorage.getItem('onboarding_complete');
    if (showOnboarding === 'true' && onboardingComplete !== 'true') {
      setIsActive(true);
    }
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.removeItem('onboarding_complete');
  }, []);

  const endTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem('onboarding_complete', 'true');
    localStorage.removeItem('show_onboarding');
  }, []);

  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener('start-onboarding-tour', handler);
    return () => window.removeEventListener('start-onboarding-tour', handler);
  }, [startTour]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      const nextIndex = currentStep + 1;
      const nextStepData = steps[nextIndex];

      if (nextStepData.route && nextStepData.route !== location.pathname) {
        navigate(nextStepData.route);
      }

      setCurrentStep(nextIndex);
    } else {
      endTour();
    }
  }, [currentStep, navigate, location.pathname, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prevIndex = currentStep - 1;
      const prevStepData = steps[prevIndex];

      if (prevStepData.route && prevStepData.route !== location.pathname) {
        navigate(prevStepData.route);
      }

      setCurrentStep(prevIndex);
    }
  }, [currentStep, navigate, location.pathname]);

  if (!isActive) return null;

  const step = steps[currentStep];
  const IconComponent = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
            <IconComponent className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100 mb-3">
          {step.title}
        </h2>

        <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed mb-6">
          {step.description}
        </p>

        <div className="flex justify-center items-center space-x-2 mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-3 bg-primary-600 dark:bg-primary-400'
                  : index < currentStep
                  ? 'w-2 bg-primary-300 dark:bg-primary-600'
                  : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          Passo {currentStep + 1} de {steps.length}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={endTour}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Pular Tutorial
          </button>

          <div className="flex items-center space-x-3">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </button>
            )}

            <button
              onClick={nextStep}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-primary-700 to-primary-500 hover:from-primary-800 hover:to-primary-600 rounded-md shadow-sm transition-all"
            >
              {isLast ? 'Começar a Usar!' : 'Próximo'}
              {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
