import { useState } from 'react';
import { FRAMEWORK_LABELS, type Framework, type Language } from './DbConfigForm';
import type { GenerateResult } from './ResultPanel';
import ResultPanel from './ResultPanel';
import Icon from './Icon';

export interface ProjectActivity {
  id: string;
  name: string;
  language: Language;
  framework: Framework;
  createdAt: string;
  result: GenerateResult;
}

interface Props {
  projects: ProjectActivity[];
  projectsView: boolean;
  onCreate: () => void;
}

export default function Dashboard({ projects, projectsView, onCreate }: Props) {
  const [search, setSearch] = useState('');
  const [frameworkFilter, setFrameworkFilter] = useState<Framework | ''>('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const selected = projects.find(project => project.id === selectedProject);
  const filtered = projects.filter(project =>
    (!frameworkFilter || project.framework === frameworkFilter) &&
    project.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const modelCount = projects.reduce((total, project) => total + (project.result.models?.length ?? 0), 0);

  return (
    <>
      <div className="workspace-title">
        <h1>{projectsView ? 'Os meus projetos' : 'Dashboard'}</h1>
        {projectsView && <button className="primary-button" onClick={() => onCreate()}><Icon name="plus" />Novo projeto</button>}
      </div>

      {!projectsView &&
        <section className="metric-grid" aria-label="Indicadores deste acesso">
          <div className="metric-card"><span>Projetos</span><Icon name="folder" /><strong>{projects.length}</strong></div>
          <div className="metric-card"><span>Modelos</span><Icon name="code" /><strong>{modelCount}</strong></div>
          <div className="metric-card"><span>Frameworks</span><Icon name="dashboard" /><strong>{new Set(projects.map(project => project.framework)).size}</strong></div>
        </section>
      }

      <section className="projects-section" aria-labelledby="projects-title">
        <div className="panel-heading"><div><h2 id="projects-title">Projetos</h2><p>Histórico temporário · limpo ao sair ou atualizar.</p></div><span className="count-label">{projects.length}</span></div>
        <div className="project-toolbar">
          <label className="project-search"><Icon name="search" /><input type="search" placeholder="Pesquisar projeto..." value={search} onChange={event => setSearch(event.target.value)} aria-label="Pesquisar projeto" /></label>
          <select value={frameworkFilter} onChange={event => {
            const value = event.target.value;
            if (value === '' || value === 'nestjs' || value === 'express' || value === 'fastify' || value === 'aspnetcore') setFrameworkFilter(value);
          }} aria-label="Filtrar por framework"><option value="">Todos os frameworks</option><option value="nestjs">NestJS</option><option value="express">Express</option><option value="fastify">Fastify</option><option value="aspnetcore">ASP.NET Core</option></select>
        </div>
        {filtered.length > 0 ? <div className="project-table-wrap"><table className="project-table"><thead><tr><th>Projeto</th><th>Framework</th><th>Modelos</th><th>Gerado em</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {filtered.map(project => <tr key={project.id}><td><span className="project-title"><span className="project-file-icon"><Icon name="folder" /></span><strong>{project.name}</strong></span></td><td><span className="framework-tag">{FRAMEWORK_LABELS[project.framework]}</span></td><td>{project.result.models?.length ?? 0}</td><td>{new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(project.createdAt))}</td><td><button className="detail-button" onClick={() => setSelectedProject(project.id)} aria-label={`Ver detalhes de ${project.name}`}>Detalhes <Icon name="arrow" /></button></td></tr>)}
        </tbody></table></div> : <div className="projects-empty"><span className="empty-icon"><Icon name={projects.length ? 'search' : 'folder'} /></span><h3>{projects.length ? 'Nenhum resultado' : 'Ainda sem projetos'}</h3>{projects.length > 0 && <button className="text-button" onClick={() => { setSearch(''); setFrameworkFilter(''); }}>Limpar filtros</button>}</div>}
      </section>
      {selected && <section className="project-detail" aria-label={`Detalhes de ${selected.name}`}><div className="panel-heading"><h2>{selected.name}</h2><button className="icon-button" onClick={() => setSelectedProject(null)} aria-label="Fechar detalhes"><Icon name="close" /></button></div><ResultPanel result={selected.result} loading={false} /></section>}
    </>
  );
}
