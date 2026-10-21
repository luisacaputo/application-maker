import { useEffect, useRef, useState } from 'react';
import DbConfigForm, { type FormData, type Framework, type Language, FRAMEWORK_LABELS, LANGUAGE_LABELS, ORM_LABELS, isProjectNameValid } from './DbConfigForm';
import ResultPanel, { type GenerateResult } from './ResultPanel';
import Icon from './Icon';

const API_BASE = '/api';

interface Props {
  request: { sequence: number };
  onGenerated: (result: GenerateResult, language: Language, framework: Framework) => void;
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
    setForm({ projectName: '', connectionString: '', language: 'nodejs', framework: 'nestjs', orm: 'prisma' });
    setResult(null);
  }, [request]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const handleFormChange = (nextForm: FormData) => {
    setForm(nextForm);
    setResult(null);
  };

  const isValid = () => form.connectionString.trim().length > 0 && isProjectNameValid(form.projectName);

  const handleGenerate = async () => {
    if (loading || !isValid()) return;

    const { language, framework, orm } = form;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    onBusyChange(true);
    setResult(null);

    try {
      const response = await fetch(
        language === 'nodejs'
          ? `${API_BASE}/generateapi/nodejs/${framework}/prisma`
          : `${API_BASE}/generateapi/csharp`,
        {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: form.connectionString,
          projectName: form.projectName.trim() || undefined,
          framework,
          orm,
        }),
        },
      );

      const responseData = await response.json();
      if (controller.signal.aborted) return;

      if (!response.ok || responseData.error || responseData.success !== true) {
        setResult({
          success: false,
          message: responseData.error || responseData.message || 'Erro ao gerar projecto',
          error: responseData.error || responseData.message || JSON.stringify(responseData),
        });
      } else if (responseData.framework !== framework || responseData.orm !== orm) {
        setResult({
          success: false,
          message: 'A tecnologia gerada não corresponde à selecionada.',
          error: `Foi solicitado ${FRAMEWORK_LABELS[framework]} com ${ORM_LABELS[orm]}, mas a API devolveu ${responseData.framework || 'um framework não identificado'} com ${responseData.orm || 'um ORM não identificado'}. O projeto não foi confirmado. Verifique se o backend está atualizado e gere novamente.`,
        });
      } else {
        const data: GenerateResult = {
          ...responseData,
          language,
          framework,
          orm,
          models: responseData.models || responseData.tables,
        };
        setResult(data);
        onGenerated(data, language, framework);
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
      <button className="back-button" onClick={onBack} disabled={loading}><Icon name="arrow" />Os meus projetos</button>
      <section className="workspace-section" aria-labelledby="configuration-title">
        <div className="workspace-title">
          <div>
            <h1 id="configuration-title">Novo projeto</h1>
            <p>Crie uma API com {LANGUAGE_LABELS[form.language]} a partir da sua base de dados.</p>
          </div>
        </div>

        <div className="workspace-grid">
          <div className="configuration-column">
            <DbConfigForm data={form} onChange={handleFormChange} disabled={loading} />
            <div className="generate-row">
              <div className="validation-hint" aria-live="polite">
                {!isValid() && <><span className="hint-dot" /> {isProjectNameValid(form.projectName)
                  ? 'Indique a ligação à base de dados para continuar.'
                  : 'Corrija o nome do projeto para continuar.'}</>}
              </div>
              <button
                id="btn-generate"
                className="btn-generate"
                onClick={handleGenerate}
                disabled={loading || !isValid()}
                aria-busy={loading}
              >
                {loading ? <><span className="spinner" /> A gerar {FRAMEWORK_LABELS[form.framework]}...</> : <>Gerar projeto <span className="button-arrow">→</span></>}
              </button>
            </div>
          </div>
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
