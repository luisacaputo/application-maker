import { useState } from 'react';
import './index.css';
import LanguageSelector, { Language } from './components/LanguageSelector';
import DbConfigForm, { FormData } from './components/DbConfigForm';
import ResultPanel, { GenerateResult } from './components/ResultPanel';

const API_BASE = 'http://localhost:5002';

const LANG_ENDPOINTS: Record<Language, string> = {
  nodejs: '/generateapi/nodejs',
  csharp: '/generateapi/csharp',
  python: '/generateapi/python',
  go: '/generateapi/go',
};

function App() {
  const [language, setLanguage] = useState<Language>('nodejs');

  const [form, setForm] = useState<FormData>({
    host: 'localhost',
    port: '3306',
    database: '',
    username: 'root',
    password: '',
    databasetype: 'mysql',
    projectname: '',
    path: 'C:/Projects',
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const isValid = () => {
    if (!form.projectname.trim() || !form.path.trim() || !form.database.trim()) return false;
    if (form.databasetype !== 'sqlite' && (!form.host.trim() || !form.username.trim())) return false;
    return true;
  };

  const handleGenerate = async () => {
    if (!isValid()) return;

    setLoading(true);
    setResult(null);

    try {
      const endpoint = `${API_BASE}${LANG_ENDPOINTS[language]}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: form.host,
          port: Number(form.port),
          database: form.database,
          username: form.username,
          password: form.password,
          databasetype: form.databasetype,
          projectname: form.projectname,
          path: form.path,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setResult({
          success: false,
          message: data.error || 'Erro ao gerar projecto',
          language,
          error: data.error || JSON.stringify(data),
        });
      } else {
        setResult({ ...data, language });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão com a API';
      setResult({
        success: false,
        message: msg,
        language,
        error: `Não foi possível contactar a API em ${API_BASE}. Certifique-se que o backend está a correr (npm run dev na pasta Nodejs/).`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">⚡</div>
          <div>
            <div className="header-title">Application Maker</div>
            <div className="header-subtitle">Code Generator from Database</div>
          </div>
        </div>
        <div className="header-badge">
          <span className="header-badge-dot" />
          API v2.0
        </div>
      </header>

      {/* Main */}
      <main className="main">
        {/* Hero */}
        <div className="page-hero">
          <h1>
            Gere o teu projecto <span>em segundos</span>
          </h1>
          <p>
            Conecta ao teu banco de dados, escolhe a linguagem e o Application Maker gera a estrutura completa do projecto.
          </p>
        </div>

        {/* Steps bar */}
        <div className="steps-bar" aria-label="Passos de configuração">
          <div className="step active">
            <div className="step-number">1</div>
            <span className="step-label">Linguagem</span>
          </div>
          <div className="step-divider" />
          <div className="step active">
            <div className="step-number">2</div>
            <span className="step-label">Base de Dados</span>
          </div>
          <div className="step-divider" />
          <div className={`step ${result?.success ? 'done' : ''}`}>
            <div className="step-number">{result?.success ? '✓' : '3'}</div>
            <span className="step-label">Gerar</span>
          </div>
        </div>

        {/* Language Selector */}
        <LanguageSelector value={language} onChange={setLanguage} />

        {/* DB Config Form */}
        <DbConfigForm data={form} language={language} onChange={setForm} />

        {/* Generate Button */}
        <button
          id="btn-generate"
          className="btn-generate"
          onClick={handleGenerate}
          disabled={loading || !isValid()}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <div className="spinner" />
              A gerar projecto...
            </>
          ) : (
            <>
              ⚡ Gerar Projecto
            </>
          )}
        </button>

        {/* Validation hint */}
        {!isValid() && !loading && (
          <div style={{
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--text-muted)',
            marginTop: 8,
          }}>
            Preenche todos os campos obrigatórios para continuar
          </div>
        )}

        {/* Result Panel */}
        {(loading || result) && (
          <div style={{ marginTop: 32 }}>
            <ResultPanel result={result} loading={loading} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        Application Maker &copy; {new Date().getFullYear()} · Node.js · C# .NET 8 · Python Django · Go
      </footer>
    </div>
  );
}

export default App;
