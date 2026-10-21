import React, { useState } from 'react';
import { FRAMEWORK_LABELS, ORM_LABELS } from './DbConfigForm';

export interface GenerateResult {
  success: boolean;
  message: string;
  language?: string;
  framework?: string;
  orm?: string;
  projectname?: string;
  path?: string;
  downloadUrl?: string;
  models?: string[];
  skippedModels?: string[];
  error?: string;
}

interface Props {
  result: GenerateResult | null;
  loading: boolean;
}

const ResultPanel: React.FC<Props> = ({ result, loading }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const framework = result?.framework;
  const frameworkLabel = Object.entries(FRAMEWORK_LABELS).find(([value]) => value === framework)?.[1] || framework || 'Não informado';
  const ormLabel = Object.entries(ORM_LABELS).find(([value]) => value === result?.orm)?.[1] || result?.orm || 'Não informado';

  async function downloadZip() {
    if (!result?.downloadUrl || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    let objectUrl: string | undefined;
    try {
      const response = await fetch(`/api${result.downloadUrl}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Não foi possível baixar o ZIP.');
      }
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${result.projectname || 'projeto'}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Não foi possível baixar o ZIP. Tente novamente.');
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloading(false);
    }
  }
  if (loading) {
    return (
      <div className="result-panel">
        <div className="result-header loading">
          <span className="result-icon" aria-hidden="true"><span className="spinner" /></span>
          <span>A gerar projeto...</span>
        </div>
        <div className="result-body">
          <p className="result-description">A conectar à base de dados e a gerar os ficheiros da aplicação.</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (!result.success) {
    return (
      <div className="result-panel">
        <div className="result-header error">
          <span className="result-icon" aria-hidden="true">!</span>
          <span>Erro ao gerar projecto</span>
        </div>
        <div className="result-body">
          <div className="result-error">
            {result.error || result.message}
          </div>
          <div className="result-description">
            Verifique as credenciais da base de dados e a pasta de destino.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="result-panel">
      <div className="result-header success">
        <span className="result-icon" aria-hidden="true">✓</span>
        <span>Projeto gerado com sucesso</span>
        <span className="result-stack">{frameworkLabel} + {ormLabel}</span>
      </div>
      <div className="result-body">
        {result.downloadUrl && <div className="project-download">
          <button type="button" className="primary-button" onClick={downloadZip} disabled={downloading} aria-busy={downloading}>
            {downloading ? 'A baixar...' : 'Baixar projeto (.zip)'}
          </button>
          <p>O ZIP inclui a configuração da base de dados. Não partilhe ficheiros com credenciais.</p>
          {downloadError && <p className="result-error" role="alert">{downloadError}</p>}
        </div>}
        <div className="result-meta">
          <div className="result-meta-item">
            <div className="result-meta-label">Framework</div>
            <div className="result-meta-value">{frameworkLabel}</div>
          </div>
          <div className="result-meta-item">
            <div className="result-meta-label">ORM</div>
            <div className="result-meta-value">{ormLabel}</div>
          </div>
          <div className="result-meta-item">
            <div className="result-meta-label">Projeto</div>
            <div className="result-meta-value">{result.projectname || '-'}</div>
          </div>
        </div>

        {result.models && result.models.length > 0 && (
          <div className="result-tables">
            <div className="result-tables-label">
              {result.models.length} modelo{result.models.length !== 1 ? 's' : ''} gerado{result.models.length !== 1 ? 's' : ''}
            </div>
            <div className="result-tables-grid">
              {result.models.map((t) => (
                <span key={t} className="result-table-tag">{t}</span>
              ))}
            </div>
          </div>
        )}

        {result.skippedModels && result.skippedModels.length > 0 && (
          <div className="result-tables">
            <div className="result-tables-label">
              Modelos ignorados: não têm uma chave simples suportada para CRUD
            </div>
            <div className="result-tables-grid">
              {result.skippedModels.map((model) => (
                <span key={model} className="result-table-tag">{model}</span>
              ))}
            </div>
          </div>
        )}

        <div className="result-path-label">
          {result.language === 'csharp' ? 'Localização do projeto no servidor' : 'Localização do projecto'}
        </div>
        <div className="result-path">
          {result.path}
        </div>

        {result.path && (
          <div className="result-commands">
            <div className="result-commands-label">{result.language === 'csharp' ? 'Correr no seu computador' : 'Próximos passos'}</div>
            {result.language === 'csharp'
              ? <>
                <p className="result-description">Instale o SDK .NET 8, extraia o ZIP e abra um terminal na pasta que contém o projeto. Confirme a ligação em appsettings.json; para SQLite, indique um ficheiro disponível no seu computador.</p>
                <pre className="project-run-commands"><code>{'dotnet restore\ndotnet run --launch-profile http'}</code></pre>
                <p className="result-description">Swagger: <a href="http://localhost:5000/swagger" target="_blank" rel="noreferrer">http://localhost:5000/swagger</a>. Para parar, prima Ctrl+C.</p>
              </>
              : <><p className="result-description">Extraia o ZIP e abra um terminal na pasta do projeto.</p><div className="result-command-line">cp .env.example .env</div><div className="result-command-line">Editar DATABASE_URL em .env</div><div className="result-command-line">npm install</div><div className="result-command-line">npm run start:dev</div></>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
