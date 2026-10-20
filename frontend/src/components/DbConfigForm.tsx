import React from 'react';
import { Language } from './LanguageSelector';

export type DbType = 'mysql' | 'sql' | 'postgres' | 'sqlite';

export interface FormData {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  databasetype: DbType;
  projectname: string;
  path: string;
}

interface Props {
  data: FormData;
  language: Language;
  onChange: (data: FormData) => void;
}

const DB_OPTIONS: { value: DbType; label: string }[] = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sql', label: 'SQL Server (MSSQL)' },
  { value: 'sqlite', label: 'SQLite' },
];

const DEFAULT_PORTS: Record<DbType, string> = {
  mysql: '3306',
  postgres: '5432',
  sql: '1433',
  sqlite: '0',
};

const DbConfigForm: React.FC<Props> = ({ data, onChange }) => {
  const set = (field: keyof FormData, value: string) => {
    const next = { ...data, [field]: value };
    // Auto-fill port when db type changes
    if (field === 'databasetype') {
      next.port = DEFAULT_PORTS[value as DbType] || data.port;
    }
    onChange(next);
  };

  const isSqlite = data.databasetype === 'sqlite';

  return (
    <>
      {/* Database Connection */}
      <div className="form-card">
        <div className="form-card-title">
          <span className="form-card-title-icon">🔌</span>
          Ligação ao Banco de Dados
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="db-type">
              Tipo de Banco <span className="required">*</span>
            </label>
            <select
              id="db-type"
              className="form-select"
              value={data.databasetype}
              onChange={(e) => set('databasetype', e.target.value)}
            >
              {DB_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="db-host">
              Host {!isSqlite && <span className="required">*</span>}
            </label>
            <input
              id="db-host"
              type="text"
              className="form-input"
              placeholder={isSqlite ? 'N/A para SQLite' : 'localhost'}
              value={data.host}
              onChange={(e) => set('host', e.target.value)}
              disabled={isSqlite}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="db-port">
              Porta {!isSqlite && <span className="required">*</span>}
            </label>
            <input
              id="db-port"
              type="number"
              className="form-input"
              placeholder={DEFAULT_PORTS[data.databasetype]}
              value={data.port}
              onChange={(e) => set('port', e.target.value)}
              disabled={isSqlite}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="db-name">
              Nome da Base de Dados <span className="required">*</span>
            </label>
            <input
              id="db-name"
              type="text"
              className="form-input"
              placeholder="my_database"
              value={data.database}
              onChange={(e) => set('database', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="db-user">
              Utilizador {!isSqlite && <span className="required">*</span>}
            </label>
            <input
              id="db-user"
              type="text"
              className="form-input"
              placeholder={isSqlite ? 'N/A' : 'root'}
              value={data.username}
              onChange={(e) => set('username', e.target.value)}
              disabled={isSqlite}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="db-pass">
              Password {!isSqlite && <span className="required">*</span>}
            </label>
            <input
              id="db-pass"
              type="password"
              className="form-input"
              placeholder={isSqlite ? 'N/A' : '••••••••'}
              value={data.password}
              onChange={(e) => set('password', e.target.value)}
              disabled={isSqlite}
            />
          </div>
        </div>
      </div>

      {/* Project Settings */}
      <div className="form-card">
        <div className="form-card-title">
          <span className="form-card-title-icon">📁</span>
          Configurações do Projecto
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="proj-name">
              Nome do Projecto <span className="required">*</span>
            </label>
            <input
              id="proj-name"
              type="text"
              className="form-input"
              placeholder="MeuProjecto"
              value={data.projectname}
              onChange={(e) => set('projectname', e.target.value)}
            />
            <span className="form-hint">Sem espaços. Ex: MyApp, BackendAPI</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-path">
              Pasta de Destino <span className="required">*</span>
            </label>
            <input
              id="proj-path"
              type="text"
              className="form-input"
              placeholder="C:/Projectos"
              value={data.path}
              onChange={(e) => set('path', e.target.value)}
            />
            <span className="form-hint">Caminho absoluto onde o projecto será criado</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default DbConfigForm;
