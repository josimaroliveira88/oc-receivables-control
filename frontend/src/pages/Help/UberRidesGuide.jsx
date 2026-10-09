import React from 'react';
import {
  ArrowLeft,
  Download,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const EXTENSION_ZIP_URL = '/captures-extension.zip';

const steps = [
  {
    title: 'Por que instalar manualmente?',
    body: 'A extensão é de uso pessoal e não está publicada na Chrome Web Store. Por isso o Chrome exige carregá-la no "Modo do desenvolvedor" a partir de uma pasta — não é preciso publicar nem pagar nada.',
  },
  {
    title: 'Baixe e descompacte',
    body: 'Baixe o ZIP (botão acima) e descompacte em uma pasta de sua preferência (Guarde onde ela fica: o Chrome vai precisar apontar para ela).',
  },
  {
    title: 'Carregue a extensão sem compactação',
    body: 'Abra chrome://extensions/, ative o "Modo do desenvolvedor" (canto superior direito) e clique em "Carregar sem compactação", selecionando a pasta descompactada. A extensão fica instalada e sobrevive a reinícios do Chrome.',
  },
  {
    title: 'Configure o token',
    body: 'No app, clique em "Como capturar?" em Finanças e gere um token (prefixo cr_). Copie e cole no popup da extensão, em "Token de acesso", e clique em Salvar. Confirme o endereço do servidor.',
  },
  {
    title: 'Capture na página do Uber',
    body: 'Abra riders.uber.com, faça login, ajuste Início e Fim e clique em "Enviar para o Controle de Recebíveis". O app abre em nova aba com as corridas importadas.',
  },
];

const UberRidesGuide = () => (
  <div className="bg-surface border border-line rounded-lg shadow-md">
    <div className="border-b border-line px-6 py-4 flex items-center gap-3">
      <Link
        to="/finances"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Voltar
      </Link>
      <h2 className="text-xl font-semibold text-ink">
        Corridas Uber — como capturar
      </h2>
    </div>

    <div className="px-6 py-5 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
          <MonitorSmartphone
            className="w-6 h-6 text-accent"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">
          A extensão do Chrome captura as corridas dos perfis pessoal e família
          direto da sua sessão do Uber e envia ao app. Se preferir, ainda é
          possível copiar o JSON e colar na tela de importação.
        </p>
      </div>

      <a
        href={EXTENSION_ZIP_URL}
        download
        data-testid="uber-rides-guide-download"
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-on font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        Baixar extensão (ZIP)
      </a>

      <ol className="space-y-5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-soft text-accent-on-soft text-sm font-semibold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-ink">{step.title}</p>
              <p className="text-sm text-ink-soft leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-line bg-base px-4 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-info-fg" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">Diagnóstico rápido</p>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">
          Com a extensão ativa em riders.uber.com, o console (F12) mostra duas
          linhas com o rótulo de build (
          <code className="font-mono text-xs">v0.5.0 · app-token</code>). Se
          faltar uma, remova e re-adicione a extensão em chrome://extensions. Ao
          mudar o manifest, o botão Atualizar pode não reler as permissões.
        </p>
        <p className="text-sm text-ink-soft leading-relaxed">
          O aviso &quot;Aguardando uma chamada do Uber…&quot; desaparece após
          recarregar (F5) a página de corridas do Uber.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-base px-4 py-4 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success-fg" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">Limitações</p>
        </div>
        <ul className="list-disc list-inside text-sm text-ink-soft leading-relaxed space-y-1">
          <li>
            O endpoint do Uber é privado e pode mudar sem aviso — nesse caso,
            ainda dá para colar um JSON manualmente.
          </li>
          <li>
            A extensão não publica nada, não contorna proteção de automação e só
            age quando você clica no botão.
          </li>
          <li>Requer Chrome 111+.</li>
        </ul>
      </div>
    </div>
  </div>
);

export default UberRidesGuide;
