'use client';

import { useState } from 'react';

export default function LoginView({ onLoginSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'registro'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Formulario Login
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  // Formulario Registro
  const [regNombre, setRegNombre] = useState('');
  const [regCorreo, setRegCorreo] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!correo || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      if (data.ok && data.usuario) {
        onLoginSuccess(data.usuario);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistro(e) {
    e.preventDefault();
    setError('');

    if (!regNombre || !regCorreo || !regPassword || !regConfirmPassword) {
      setError('Por favor completa todos los campos para crear tu usuario.');
      return;
    }

    if (regPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: regNombre,
          correo: regCorreo,
          password: regPassword,
          rol: 'admin',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar el usuario');
      }

      if (data.ok && data.usuario) {
        onLoginSuccess(data.usuario);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setTab('login');
    setCorreo('admin@rentacarjc.com');
    setPassword('admin123456');
    setError('');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand-logo">JC</div>
          <h1>Rentacar JC</h1>
          <p>Sistema de Gestión de Alquiler de Vehículos</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab-btn ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className={`login-tab-btn ${tab === 'registro' ? 'active' : ''}`}
            onClick={() => { setTab('registro'); setError(''); }}
          >
            Crear Usuario
          </button>
        </div>

        {error && (
          <div className="login-error-alert" style={{ marginBottom: 16 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {tab === 'login' ? (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label>Correo Electrónico</label>
              <div className="login-input-wrap">
                <input
                  type="email"
                  placeholder="ejemplo@rentacarjc.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Contraseña</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleRegistro}>
            <div className="login-field">
              <label>Nombre Completo</label>
              <div className="login-input-wrap">
                <input
                  type="text"
                  placeholder="Ej: Valeria Arango"
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Correo Electrónico</label>
              <div className="login-input-wrap">
                <input
                  type="email"
                  placeholder="nuevo@rentacarjc.com"
                  value={regCorreo}
                  onChange={(e) => setRegCorreo(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Contraseña (mínimo 6 caracteres)</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nueva contraseña"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Confirmar Contraseña</label>
              <div className="login-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repite la contraseña"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar y Entrar'}
            </button>
          </form>
        )}

        {tab === 'login' && (
          <div className="login-demo-pill">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong>Credenciales de inicio:</strong>
              <button
                type="button"
                onClick={fillDemo}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Autocompletar
              </button>
            </div>
            <div>Correo: <code>admin@rentacarjc.com</code></div>
            <div>Clave: <code>admin123456</code></div>
          </div>
        )}
      </div>
    </div>
  );
}
