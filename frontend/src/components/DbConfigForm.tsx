import React from 'react';

export type Framework = 'nestjs' | 'express' | 'fastify';
export type Language = 'nodejs' | 'csharp' | 'go' | 'python';
export type StackFramework = Framework | 'aspnetcore' | 'nethttp' | 'django';
export type Orm = 'prisma' | 'efcore' | 'none' | 'django';

export const FRAMEWORK_LABELS: Record<StackFramework, string> = {
  nestjs: 'NestJS', express: 'Express', fastify: 'Fastify',
  aspnetcore: 'ASP.NET Core', nethttp: 'net/http', django: 'Django REST Framework',
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  nodejs: 'Node.js', csharp: 'C#', go: 'Go', python: 'Python',
};

export const ORM_LABELS: Record<Orm, string> = {
  prisma: 'Prisma', efcore: 'Entity Framework Core', none: 'Sem ORM (SQL direto)', django: 'Django ORM',
};

const LANGUAGE_FRAMEWORKS: Record<Language, readonly StackFramework[]> = {
  nodejs: ['nestjs', 'express', 'fastify'],
  csharp: ['aspnetcore'],
  go: ['nethttp'],
  python: ['django'],
};

const FRAMEWORK_ORMS: Record<StackFramework, readonly Orm[]> = {
  nestjs: ['prisma'], express: ['prisma'], fastify: ['prisma'],
  aspnetcore: ['efcore'], nethttp: ['none'], django: ['django'],
};

export function isNodeFramework(value: StackFramework): value is Framework {
  return value === 'nestjs' || value === 'express' || value === 'fastify';
}

export function isProjectNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === '' ||
    (/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(trimmed) && trimmed !== 'node_modules');
}

export interface FormData {
  projectName: string;
  connectionString: string;
  language: Language;
  framework: StackFramework;
  orm: Orm;
}

interface Props {
  data: FormData;
  onChange: (data: FormData) => void;
  disabled?: boolean;
}

const DbConfigForm: React.FC<Props> = ({ data, onChange, disabled = false }) => {
  const set = <K extends keyof FormData>(field: K, value: FormData[K]) => onChange({ ...data, [field]: value });

  return (
    <section className="form-card" aria-labelledby="form-card-title">
        <div className="form-card-title">
          <span className="form-card-title-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="presentation">
              <path d="M8 7V4m8 3V4M7 12h10M6 20h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z" />
            </svg>
          </span>
          <div>
            <h3 id="form-card-title">Tecnologia e ligação</h3>
            <p>Selecione a stack e indique a origem dos dados.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group span-2">
            <label className="form-label" htmlFor="project-name">Nome do projeto (opcional)</label>
            <input
              id="project-name"
              disabled={disabled}
              className="form-input"
              value={data.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              placeholder="minha-api"
              maxLength={80}
              autoComplete="off"
              aria-invalid={!isProjectNameValid(data.projectName)}
              aria-describedby="project-name-hint"
            />
            <span id="project-name-hint" className="form-hint">
              {isProjectNameValid(data.projectName)
                ? 'Use letras minúsculas, números e hífen. Sem nome, será gerado um automaticamente.'
                : 'Nome inválido: use 1 a 80 letras minúsculas, números ou hífen, sem hífen nas extremidades. node_modules é reservado.'}
            </span>
          </div>
          <div className="form-group span-2">
            <label className="form-label" htmlFor="language">
              Linguagem <span className="required">*</span>
            </label>
            <select
              id="language"
              disabled={disabled}
              className="form-select"
              value={data.language}
              onChange={(event) => {
                const language = event.target.value;
                if (language !== 'nodejs' && language !== 'csharp' && language !== 'go' && language !== 'python') return;
                const framework = LANGUAGE_FRAMEWORKS[language][0];
                onChange({ ...data, language, framework, orm: FRAMEWORK_ORMS[framework][0] });
              }}
            >
              {Object.entries(LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="framework">
              Framework <span className="required">*</span>
            </label>
            <select
              id="framework"
              disabled={disabled}
              className="form-select"
              value={data.framework}
              onChange={(e) => {
                const framework = LANGUAGE_FRAMEWORKS[data.language].find(value => value === e.target.value);
                if (framework) onChange({ ...data, framework, orm: FRAMEWORK_ORMS[framework][0] });
              }}
            >
              {LANGUAGE_FRAMEWORKS[data.language].map(framework => <option key={framework} value={framework}>{FRAMEWORK_LABELS[framework]}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="orm">
              ORM <span className="required">*</span>
            </label>
            <select
              id="orm"
              disabled={disabled}
              className="form-select"
              value={data.orm}
              onChange={(e) => {
                const orm = FRAMEWORK_ORMS[data.framework].find(value => value === e.target.value);
                if (orm) set('orm', orm);
              }}
            >
              {FRAMEWORK_ORMS[data.framework].map(orm => <option key={orm} value={orm}>{ORM_LABELS[orm]}</option>)}
            </select>
          </div>

          <div className="form-group span-2">
            <label className="form-label" htmlFor="connection-string">
              Connection string <span className="required">*</span>
            </label>
            <input
              id="connection-string"
              disabled={disabled}
              type="password"
              className="form-input"
              placeholder="postgresql://user:password@host:5432/database?schema=public"
              autoComplete="new-password"
              value={data.connectionString}
              onChange={(e) => set('connectionString', e.target.value)}
            />
            {data.language === 'nodejs' && <span className="form-hint">
              Compatível com PostgreSQL, MySQL, SQL Server e SQLite. A credencial não é incluída no projeto gerado.
            </span>}
          </div>
        </div>
    </section>
  );
};

export default DbConfigForm;
