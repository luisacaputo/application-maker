import { useEffect, useRef, useState } from 'react';
import DbConfigForm, { type FormData, type Framework, FRAMEWORK_LABELS, LANGUAGE_LABELS, ORM_LABELS, isNodeFramework, isProjectNameValid } from './DbConfigForm';
import ResultPanel, { type GenerateResult } from './ResultPanel';
import Icon from './Icon';

const API_BASE = 'http://localhost:5002';

interface Props {
  request: { framework: Framework; sequence: number };
  onGenerated: (result: GenerateResult, framework: Framework) => void;
  onBusyChange: (busy: boolean) => void;
  onBack: () => void;
}

function ProjectGenerator({ request, onGenerated, onBusyChange, onBack }: Props) {
  const [form, setForm] = useState<FormData>({
    projectName: '',
    connectionString: '',
    language: 'nodejs',
    framework: 'nestjs',
    orm: 'prisma',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setForm({ projectName: '', connectionString: '', language: 'nodejs', framework: request.framework, orm: 'prisma' });
    setResult(null);
  }, [request]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleFormChange = (nextForm: FormData) => {
    setForm(nextForm);
    setResult(null);
  };

  const generationAvailable = form.language === 'nodejs' && isNodeFramework(form.framework) && form.orm === 'prisma';
  const isValid = () => {
    return generationAvailable && form.connectionString.trim().length > 0 && isProjectNameValid(form.projectName);
  };

  const handleGenerate = async () => {
    if (loading || !isValid() || !isNodeFramework(form.framework)) return;

    const requestedFramework = form.framework;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    onBusyChange(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/generateapi/nodejs/${requestedFramework}/prisma`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: form.connectionString,
          projectName: form.projectName.trim() || undefined,
          framework: requestedFramework,
          orm: form.orm,
        }),
      });

      const data = await response.json();
      if (controller.signal.aborted) return;

      if (!response.ok || data.error || data.success !== true) {
        setResult({
          success: false,
          message: data.error || data.message || 'Erro ao gerar projecto',
          error: data.error || data.message || JSON.stringify(data),
        });
      } else if (data.framework !== requestedFramework) {
        setResult({
          success: false,
          message: 'O framework gerado não corresponde ao selecionado.',
          error: `Foi solicitado ${FRAMEWORK_LABELS[requestedFramework]}, mas a API devolveu ${data.framework || 'um framework não identificado'}. O projeto não foi confirmado. Verifique se o backend está atualizado e gere novamente.`,
        });
      } else {
        setResult(data);
        onGenerated(data, requestedFramework);
        setForm(current => ({ ...current, connectionString: '' }));
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Erro de conexão com a API';
      setResult({
        success: false,
        message: msg,
        error: `Não foi possível contactar a API em ${API_BASE}. Certifique-se que o backend está a correr (npm run dev na pasta Nodejs/).`,
      });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        onBusyChange(false);
      }
    }
  };

  return (
    <>
      <button className="back-button" onClick={onBack} disabled={loading}><Icon name="arrow" />Voltar ao dashboard</button>
      <div className="workspace-title">
        <span className="generator-caption">01 / CONFIGURAR E GERAR</span>
      </div>

      <section className="workspace-section" aria-labelledby="configuration-title">
        <div className="section-heading">
          <div>
            <div className="section-kicker">CONFIGURAÇÃO</div>
            <h2 id="configuration-title">Prepare a sua aplicação</h2>
            <p>Defina a tecnologia e os dados de acesso à origem.</p>
          </div>
          <span className="required-note"><span className="required">*</span> Campos obrigatórios</span>
        </div>

        <div className="workspace-grid">
          <div className="configuration-column">
            <div className="steps-bar" aria-label="Passos de configuração">
              <div className="step done"><span className="step-number">✓</span><span className="step-label">Tecnologia</span></div>
              <span className="step-divider" />
              <div className={`step ${form.connectionString.trim() ? 'done' : 'active'}`}>
                <span className="step-number">{form.connectionString.trim() ? '✓' : '2'}</span>
                <span className="step-label">Ligação</span>
              </div>
              <span className="step-divider" />
              <div className={`step ${result?.success ? 'done' : ''}`}>
                <span className="step-number">{result?.success ? '✓' : '3'}</span>
                <span className="step-label">Geração</span>
              </div>
            </div>
            <DbConfigForm data={form} onChange={handleFormChange} disabled={loading} />
            {!generationAvailable && <p id="generation-availability" className="stack-availability" role="status">A geração para {LANGUAGE_LABELS[form.language]} ainda não está ligada nesta tela. Selecione Node.js para gerar.</p>}
            <div className="generate-row">
              <div className="validation-hint" aria-live="polite">
                {generationAvailable && !isValid() && <><span className="hint-dot" /> {isProjectNameValid(form.projectName)
                  ? 'Introduza a connection string para continuar.'
                  : 'Corrija o nome do projeto para continuar.'}</>}
              </div>
              <button
                id="btn-generate"
                className="btn-generate"
                onClick={handleGenerate}
                disabled={loading || !isValid()}
                aria-describedby={!generationAvailable ? 'generation-availability' : undefined}
                aria-busy={loading}
              >
                {loading ? <><span className="spinner" /> A gerar {FRAMEWORK_LABELS[form.framework]}...</> : <>Gerar aplicação <span className="button-arrow">→</span></>}
              </button>
            </div>
          </div>
          <aside className="summary-card" aria-label="Resumo da configuração">
            <div className="summary-heading">
              <span className="summary-icon"><Icon name="code" /></span>
              <div><h3>Resumo</h3><span>Stack selecionada</span></div>
            </div>
            <div className="summary-stack">
              <div className="stack-row">
                <span className="stack-label">Projeto</span>
                <span className="stack-value project-name">{form.projectName.trim() || 'Nome automático'}</span>
              </div>
              <div className="stack-row">
                <span className="stack-label">Linguagem</span>
                <span className="stack-value">{LANGUAGE_LABELS[form.language]}</span>
              </div>
              <div className="stack-row">
                <span className="stack-label">Framework</span>
                <span className="stack-value">{FRAMEWORK_LABELS[form.framework]}</span>
              </div>
              <div className="stack-row">
                <span className="stack-label">ORM</span>
                <span className="stack-value">{ORM_LABELS[form.orm]}</span>
              </div>
              <div className="stack-row">
                <span className="stack-label">Base de dados</span>
                <span className="stack-value">{form.connectionString.trim() ? 'Ligação configurada' : 'Por configurar'}</span>
              </div>
            </div>
            <div className="summary-divider" />
            <div className="summary-foot">
              <span className="security-symbol"><Icon name="check" /></span>
              <p><strong>{generationAvailable ? 'Segurança em primeiro lugar' : 'Pré-visualização'}</strong><br />{generationAvailable ? 'A connection string não é guardada no projeto gerado.' : 'Esta seleção não inicia uma geração.'}</p>
            </div>
          </aside>
        </div>

        {(loading || result) && (
          <div className="result-wrap">
            <ResultPanel result={result} loading={loading} />
          </div>
        )}
      </section>
    </>
  );
}

export default ProjectGenerator;
