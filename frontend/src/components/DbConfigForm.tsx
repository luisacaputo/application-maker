import React from 'react';

export type Language = 'nodejs' | 'csharp';
export type Framework = 'nestjs' | 'express' | 'fastify' | 'aspnetcore';
export type Orm = 'prisma' | 'efcore';

export const LANGUAGE_LABELS: Record<Language, string> = {
  nodejs: 'Node.js',
  csharp: 'C# / .NET',
};

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  nestjs: 'NestJS',
  express: 'Express',
  fastify: 'Fastify',
  aspnetcore: 'ASP.NET Core',
};

export const ORM_LABELS: Record<Orm, string> = {
  prisma: 'Prisma',
  efcore: 'Entity Framework Core',
};

const STACK_OPTIONS: Record<Language, { frameworks: Framework[]; orm: Orm }> = {
  nodejs: { frameworks: ['nestjs', 'express', 'fastify'], orm: 'prisma' },
  csharp: { frameworks: ['aspnetcore'], orm: 'efcore' },
};

export function isProjectNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === '' ||
    (/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(trimmed) && trimmed !== 'node_modules');
}

export interface FormData {
  projectName: string;
  connectionString: string;
  language: Language;
  framework: Framework;
  orm: Orm;
}

interface Props {
  data: FormData;
  onChange: (data: FormData) => void;
  disabled?: boolean;
}

const DbConfigForm: React.FC<Props> = ({ data, onChange, disabled = false }) => {
  const availableOptions = STACK_OPTIONS[data.language];

  const setLanguage = (language: Language) => {
    const options = STACK_OPTIONS[language];
    onChange({ ...data, language, framework: options.frameworks[0], orm: options.orm });
  };

  return (
    <section className="form-card" aria-labelledby="form-card-title">
      <div className="form-card-title">
        <div>
          <h3 id="form-card-title">Configuração</h3>
          <p>Escolha a tecnologia e configure a ligação à base de dados.</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="language">Tecnologia / linguagem <span className="required">*</span></label>
          <select
            id="language"
            disabled={disabled}
            className="form-select"
            value={data.language}
            onChange={(event) => {
              const language = event.target.value;
              if (language === 'nodejs' || language === 'csharp') setLanguage(language);
            }}
          >
            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="framework">Framework <span className="required">*</span></label>
          <select
            id="framework"
            disabled={disabled}
            className="form-select"
            value={data.framework}
            onChange={(event) => {
              const framework = availableOptions.frameworks.find(option => option === event.target.value);
              if (framework) onChange({ ...data, framework });
            }}
          >
            {availableOptions.frameworks.map(framework => <option key={framework} value={framework}>{FRAMEWORK_LABELS[framework]}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="orm">ORM <span className="required">*</span></label>
          <select
            id="orm"
            disabled={disabled}
            className="form-select"
            value={data.orm}
            onChange={(event) => {
              const orm = event.target.value;
              if (orm === 'prisma' || orm === 'efcore') onChange({ ...data, orm });
            }}
          >
            <option value={availableOptions.orm}>{ORM_LABELS[availableOptions.orm]}</option>
          </select>
        </div>

        <div className="form-group span-2">
          <label className="form-label" htmlFor="project-name">Nome do projeto <span className="optional-note">(opcional)</span></label>
          <input
            id="project-name"
            disabled={disabled}
            className="form-input"
            value={data.projectName}
            onChange={(e) => onChange({ ...data, projectName: e.target.value })}
            placeholder="minha-api"
            maxLength={80}
            autoComplete="off"
            aria-invalid={!isProjectNameValid(data.projectName)}
            aria-describedby="project-name-hint"
          />
          <span id="project-name-hint" className="form-hint">
            {isProjectNameValid(data.projectName)
              ? 'Use letras minúsculas, números e hífen. Se deixar em branco, será gerado um nome automaticamente.'
              : 'Use 1 a 80 letras minúsculas, números ou hífen, sem hífen nas extremidades. “node_modules” é reservado.'}
          </span>
        </div>

        <div className="form-group span-2">
          <label className="form-label" htmlFor="connection-string">Ligação à base de dados <span className="required">*</span></label>
          <input
            id="connection-string"
            disabled={disabled}
            type="password"
            className="form-input"
            placeholder={data.language === 'csharp'
              ? 'sqlserver://servidor:1433;database=base;user=utilizador;password=senha'
              : 'postgresql://utilizador:senha@servidor:5432/base'}
            autoComplete="new-password"
            value={data.connectionString}
            onChange={(e) => onChange({ ...data, connectionString: e.target.value })}
            aria-describedby="connection-string-hint"
          />
          <span id="connection-string-hint" className="form-hint">
            PostgreSQL, MySQL, SQL Server e SQLite. Ex.: postgresql://..., mysql://..., sqlserver://... ou file:./base.db.
            As credenciais não são guardadas no histórico.
          </span>
        </div>
      </div>
    </section>
  );
};

export default DbConfigForm;
