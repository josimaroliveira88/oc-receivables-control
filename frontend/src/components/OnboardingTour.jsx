import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  ClipboardList,
  DollarSign,
  Package,
  Navigation,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const steps = [
  {
    title: 'Bem-vindo ao Controle de Recebíveis!',
    description:
      'Vamos conhecer as principais funcionalidades do sistema em apenas alguns passos. Este tutorial rápido vai te mostrar como gerenciar clientes, pedidos e recebíveis.',
    icon: GraduationCap,
    route: null,
  },
  {
    title: 'Cadastro de Clientes',
    description:
      'Cadastre seus clientes com nome, grupos em comum (de onde vieram: grupo do WhatsApp, vizinho, família...), WhatsApp, Instagram, endereço e os marcadores VIP e Membro doTERRA. O WhatsApp vira um link que abre a conversa diretamente.',
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
    title: 'Catálogo de Produtos',
    description:
      'Consulte o catálogo de produtos dōTERRA com preços atualizados. Você pode cadastrar, editar e ativar/desativar itens da lista.',
    icon: Package,
    route: '/products',
  },
  {
    title: 'Registro de Pagamentos',
    description:
      'Registre pagamentos contra pedidos. O sistema atualiza automaticamente o status: Pendente → Parcial → Quitado. Pessoas com itens de brinde (R$ 0,00) podem receber baixa gratuita; para itens com valor, informe um valor maior que zero. Valores acima do pendente são aceitos após confirmação.',
    icon: DollarSign,
    route: '/orders',
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
      <div className="bg-surface rounded-xl shadow-2xl max-w-md w-full mx-4 p-8">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center">
            <IconComponent className="w-8 h-8 text-accent" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-center text-ink mb-3">
          {step.title}
        </h2>

        <p className="text-ink-soft text-center leading-relaxed mb-6">
          {step.description}
        </p>

        <div className="flex justify-center items-center space-x-2 mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-3 bg-accent'
                  : index < currentStep
                    ? 'w-2 bg-accent-soft'
                    : 'w-2 bg-ink-faint'
              }`}
            />
          ))}
        </div>

        <p className="text-center text-sm text-ink-faint mb-4">
          Passo {currentStep + 1} de {steps.length}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={endTour}
            className="text-sm text-ink-faint hover:text-ink transition-colors"
          >
            Pular Tutorial
          </button>

          <div className="flex items-center space-x-3">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-ink-soft bg-base hover:bg-elevated rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </button>
            )}

            <button
              onClick={nextStep}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-accent-on bg-accent hover:bg-accent-hover rounded-md shadow-sm transition-all"
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
