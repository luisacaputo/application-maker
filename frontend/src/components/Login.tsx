import { useState, type FormEvent } from 'react';
import Brand from './Brand';

export function isCorporateEmail(value: string): boolean {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@capgemini\.com$/i.test(value.trim());
}

interface Props {
  onLogin: (email: string) => void;
  error: string | null;
}

export default function Login({ onLogin, error }: Props) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const invalid = submitted && !isCorporateEmail(email);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (isCorporateEmail(email)) onLogin(email.trim().toLowerCase());
  }

  return (
    <div className="login-page">
      <main className="login-main">
        <div className="login-form-wrap">
          <Brand />
          <h1>Application Maker</h1>
          {/* <p className="login-intro">Entre com o seu email corporativo.</p> */}
          <form onSubmit={submit} noValidate>
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Escreva aqui o seu email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'login-error' : undefined}
              required
            />
            {invalid && <p id="login-error" className="login-error" role="alert">Escreva um email válido.</p>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="primary-button login-submit">Entrar</button>
          </form>
          <footer className="login-copyright">© {new Date().getFullYear()} Made with ❤️ for Capgemini by Luís Caputo</footer>
        </div>
      </main>
    </div>
  );
}
