import React from 'react';
import { Language } from './LanguageSelector';

export interface GenerateResult {
  success: boolean;
  message: string;
  language: Language;
  tables?: string[];
  data?: {
    projectname: string;
    path: string;
    databasetype: string;
    host?: string;
    database?: string;
  };
  error?: string;
}

const LANG_LABELS: Record<Language, string> = {
  nodejs: 'Node.js',
  csharp: 'C# .NET 8',
  python: 'Python Django',
  go: 'Go',
};

const NEXT_COMMANDS: Record<Language, (projectname: string, outputPath: string) => string[]> = {
  nodejs: (name, p) => [
    `cd ${p}/${name}`,
    'npm install',
    'npm run dev',
  ],
  csharp: (name, p) => [
    `cd ${p}/${name}`,
    `dotnet restore`,
    `dotnet run`,
  ],
  python: (name, p) => [
    `cd ${p}/${name}`,
    'pip install -r requirements.txt',
    'python manage.py migrate',
    'python manage.py runserver',
  ],
  go: (name, p) => [
    `cd ${p}/${name}`,
    'go mod tidy',
    'go run main.go',
  ],
};

interface Props {
  result: GenerateResult | null;
  loading: boolean;
}

const ResultPanel: React.FC<Props> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="result-panel">
        <div className="result-header loading">
          <span className="result-icon">⏳</span>
          <span>A gerar projecto...</span>
          <div style={{ marginLeft: 'auto' }}>
            <div className="spinner" style={{
              width: 16, height: 16,
              border: '2px solid rgba(99,102,241,0.3)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
          </div>
        </div>
        <div className="result-body">
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            A conectar ao banco de dados e a gerar os ficheiros...
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (!result.success) {
    return (
      <div className="result-panel">
        <div className="result-header error">
          <span className="result-icon">❌</span>
          <span>Erro ao gerar projecto</span>
        </div>
        <div className="result-body">
          <div style={{
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: 8,
            padding: '16px',
            fontFamily: 'Courier New, monospace',
            fontSize: 13,
            color: '#fda4af',
            wordBreak: 'break-word',
          }}>
            {result.error || result.message}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Verifique as credenciais da base de dados e a pasta de destino.
          </div>
        </div>
      </div>
    );
  }

  const projectname = result.data?.projectname || '';
  const outputPath = result.data?.path || '';
  const lang = result.language;
  const commands = NEXT_COMMANDS[lang]?.(projectname, outputPath) || [];

  return (
    <div className="result-panel">
      <div className="result-header success">
        <span className="result-icon">✅</span>
        <span>Projecto gerado com sucesso!</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
          {LANG_LABELS[lang]}
        </span>
      </div>
      <div className="result-body">
        <div className="result-meta">
          <div className="result-meta-item">
            <div className="result-meta-label">Linguagem</div>
            <div className="result-meta-value">{LANG_LABELS[lang]}</div>
          </div>
          <div className="result-meta-item">
            <div className="result-meta-label">Projecto</div>
            <div className="result-meta-value">{projectname}</div>
          </div>
          <div className="result-meta-item">
            <div className="result-meta-label">Base de Dados</div>
            <div className="result-meta-value">{result.data?.database || '-'}</div>
          </div>
        </div>

        {result.tables && result.tables.length > 0 && (
          <div className="result-tables">
            <div className="result-tables-label">
              {result.tables.length} tabela{result.tables.length !== 1 ? 's' : ''} detectada{result.tables.length !== 1 ? 's' : ''}
            </div>
            <div className="result-tables-grid">
              {result.tables.map((t) => (
                <span key={t} className="result-table-tag">{t}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Localização do projecto
        </div>
        <div className="result-path">
          {outputPath}/{projectname}
        </div>

        {commands.length > 0 && (
          <div className="result-commands">
            <div className="result-commands-label">Próximos passos</div>
            {commands.map((cmd, i) => (
              <div key={i} className="result-command-line">{cmd}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultPanel;
