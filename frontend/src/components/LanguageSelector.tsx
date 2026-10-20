import React from 'react';

export type Language = 'nodejs' | 'csharp' | 'python' | 'go';

interface LangOption {
  id: Language;
  icon: string;
  name: string;
  desc: string;
  color: string;
  bg: string;
  glow: string;
}

const LANGUAGES: LangOption[] = [
  {
    id: 'nodejs',
    icon: '🟢',
    name: 'Node.js',
    desc: 'TypeScript + Express + TypeORM',
    color: 'var(--lang-nodejs)',
    bg: 'var(--lang-nodejs-bg)',
    glow: 'rgba(132,204,22,0.2)',
  },
  {
    id: 'csharp',
    icon: '💜',
    name: 'C# .NET 8',
    desc: 'ASP.NET Core + Entity Framework',
    color: 'var(--lang-csharp)',
    bg: 'var(--lang-csharp-bg)',
    glow: 'rgba(168,85,247,0.2)',
  },
  {
    id: 'python',
    icon: '🐍',
    name: 'Python',
    desc: 'Django REST Framework',
    color: 'var(--lang-python)',
    bg: 'var(--lang-python-bg)',
    glow: 'rgba(59,130,246,0.2)',
  },
  {
    id: 'go',
    icon: '🐹',
    name: 'Go',
    desc: 'Standard Library + database/sql',
    color: 'var(--lang-go)',
    bg: 'var(--lang-go-bg)',
    glow: 'rgba(6,182,212,0.2)',
  },
];

interface Props {
  value: Language;
  onChange: (lang: Language) => void;
}

const LanguageSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div>
      <div className="section-label">Linguagem do projecto</div>
      <div className="lang-grid">
        {LANGUAGES.map((lang) => (
          <div
            key={lang.id}
            id={`lang-${lang.id}`}
            className={`lang-card ${value === lang.id ? 'active' : ''}`}
            style={
              value === lang.id
                ? ({
                    '--current-lang-color': lang.color,
                    '--current-lang-bg': lang.bg,
                    '--current-lang-glow': lang.glow,
                  } as React.CSSProperties)
                : {}
            }
            onClick={() => onChange(lang.id)}
            role="radio"
            aria-checked={value === lang.id}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onChange(lang.id)}
          >
            <span className="lang-icon">{lang.icon}</span>
            <span className="lang-name">{lang.name}</span>
            <span className="lang-desc">{lang.desc}</span>
            <span className="lang-check">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
