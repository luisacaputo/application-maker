import React from 'react';
import { FRAMEWORK_LABELS } from './DbConfigForm';

export interface GenerateResult {
  success: boolean;
  message: string;
  framework?: string;
  orm?: string;
  projectname?: string;
  path?: string;
  models?: string[];
  skippedModels?: string[];
  error?: string;
}

interface Props {
  result: GenerateResult | null;
  loading: boolean;
}

const ResultPanel: React.FC<Props> = ({ result, loading }) => {
  const framework = result?.framework;
  const frameworkLabel = framework === 'nestjs' || framework === 'express' || framework === 'fastify'
    ? FRAMEWORK_LABELS[framework]
    : framework || 'Não informado';
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
        <span className="result-stack">{frameworkLabel} + {result.orm === 'prisma' ? 'Prisma' : result.orm || 'Prisma'}</span>
      </div>
      <div className="result-body">
        <div className="result-meta">
          <div className="result-meta-item">
            <div className="result-meta-label">Framework</div>
            <div className="result-meta-value">{frameworkLabel}</div>
          </div>
          <div className="result-meta-item">
            <div className="result-meta-label">ORM</div>
            <div className="result-meta-value">{result.orm || 'Prisma'}</div>
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
          Localização do projecto
        </div>
        <div className="result-path">
          {result.path}
        </div>

        {result.path && (
          <div className="result-commands">
            <div className="result-commands-label">Próximos passos</div>
            <div className="result-command-line">cd {result.path}</div>
            <div className="result-command-line">cp .env.example .env</div>
            <div className="result-command-line">Editar DATABASE_URL em .env</div>
            <div className="result-command-line">npm install</div>
            <div className="result-command-line">npm run start:dev</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
