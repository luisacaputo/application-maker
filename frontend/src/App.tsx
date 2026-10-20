import { useEffect, useState } from 'react';
import './index.css';
import './workspace.css';
import Brand from './components/Brand';
import Dashboard, { type ProjectActivity } from './components/Dashboard';
import type { Framework } from './components/DbConfigForm';
import Icon from './components/Icon';
import Login, { isCorporateEmail } from './components/Login';
import ProjectGenerator from './components/ProjectGenerator';
import type { GenerateResult } from './components/ResultPanel';

type View = 'dashboard' | 'generator' | 'projects';
const SESSION_KEY = 'application-maker.email';

function getSession(): { email: string | null; error: string | null } {
  try {
    const email = sessionStorage.getItem(SESSION_KEY);
    return { email: email && isCorporateEmail(email) ? email : null, error: null };
  } catch {
    return { email: null, error: 'Não foi possível aceder ao armazenamento da sessão. Permita o armazenamento neste navegador para continuar.' };
  }
}

export default function App() {
  const [session, setSession] = useState(getSession);
  const [view, setView] = useState<View>('dashboard');
  const [projects, setProjects] = useState<ProjectActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<{ framework: Framework; sequence: number }>({ framework: 'nestjs', sequence: 0 });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [session.email, view]);

  function login(email: string) {
    if (!isCorporateEmail(email)) return;
    try {
      sessionStorage.setItem(SESSION_KEY, email);
      setSession({ email, error: null });
      setView('dashboard');
      setNotice(null);
    } catch {
      setSession({ email: null, error: 'Não foi possível iniciar a sessão. Permita o armazenamento neste navegador e tente novamente.' });
    }
  }

  function logout() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      setSession({ email: null, error: null });
    } catch {
      setSession({ email: null, error: 'A sessão foi fechada nesta página, mas o navegador não permitiu limpar o armazenamento. Feche este separador para terminar a sessão armazenada.' });
    }
    setProjects([]);
    setBusy(false);
    setNotice(null);
    setView('dashboard');
  }

  function createProject(framework: Framework = 'nestjs') {
    if (busy) return;
    setRequest(current => ({ framework, sequence: current.sequence + 1 }));
    setNotice(null);
    setView('generator');
  }

  function recordProject(result: GenerateResult, framework: Framework) {
    const createdAt = new Date().toISOString();
    setProjects(current => [{
      id: result.path || `${createdAt}-${current.length}`,
      name: result.projectname || 'Projeto sem nome',
      framework,
      createdAt,
      result,
    }, ...current]);
    setNotice('Projeto concluído.');
  }

  if (!session.email) return <Login onLogin={login} error={session.error} />;
  const email = session.email;
  const initials = email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <div className="workspace-app">
      <a className="skip-link" href="#workspace-content">Saltar para o conteúdo</a>
      <aside className="workspace-sidebar">
        <div className="sidebar-brand"><Brand /><span>APPLICATION MAKER</span></div>
        <nav className="workspace-nav" aria-label="Navegação principal">
          <button className={view === 'dashboard' ? 'selected' : ''} aria-current={view === 'dashboard' ? 'page' : undefined} disabled={busy} onClick={() => { setView('dashboard'); setNotice(null); }}><Icon name="dashboard" />Dashboard</button>
          <button className={view === 'generator' ? 'selected' : ''} aria-current={view === 'generator' ? 'page' : undefined} disabled={busy} onClick={() => createProject()}><Icon name="plus" />Novo projeto</button>
          <button className={view === 'projects' ? 'selected' : ''} aria-current={view === 'projects' ? 'page' : undefined} disabled={busy} onClick={() => { setView('projects'); setNotice(null); }}><Icon name="folder" />Os meus projetos<span className="nav-count">{projects.length}</span></button>
        </nav>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header">
          <div className="workspace-location"><strong>{view === 'dashboard' ? 'Dashboard' : view === 'generator' ? 'Novo projeto' : 'Os meus projetos'}</strong></div>
          <div className="workspace-account"><span className="account-avatar" aria-hidden="true">{initials}</span><div className="account-info"><strong>{email}</strong></div><button className="logout-button" onClick={logout}><Icon name="logout" /><span>Sair</span></button></div>
        </header>
        <main id="workspace-content" className="workspace-main" tabIndex={-1}>
          {notice && <div className="workspace-notice" role="status"><Icon name="check" /><span>{notice}</span><button className="icon-button" onClick={() => setNotice(null)} aria-label="Fechar notificação"><Icon name="close" /></button></div>}
          {view !== 'generator' && <Dashboard projects={projects} projectsView={view === 'projects'} onCreate={createProject} />}
          <div hidden={view !== 'generator'}>
            <ProjectGenerator request={request} onGenerated={recordProject} onBusyChange={setBusy} onBack={() => setView('dashboard')} />
          </div>
        </main>
      </div>
    </div>
  );
}
