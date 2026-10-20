/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ToastContainer from '@/components/ToastContainer';
import LoginView from '@/components/LoginView';
import VehiculosView from '@/components/VehiculosView';
import ClientesView from '@/components/ClientesView';
import AlquileresView from '@/components/AlquileresView';
import ReservasView from '@/components/ReservasView';
import PagosView from '@/components/PagosView';
import GastosView from '@/components/GastosView';
import EstadisticasView from '@/components/EstadisticasView';

export default function DashboardPage() {
  const [usuario, setUsuario] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vehiculos');
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const [online, setOnline] = useState(true);
  const [clock, setClock] = useState('');
  const [toasts, setToasts] = useState([]);

  // 1. Comprobar sesión de usuario activa
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.ok && data.usuario) {
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
      } catch {
        setUsuario(null);
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, []);

  // 2. Inicializar Tema y Reloj
  useEffect(() => {
    const savedTheme = localStorage.getItem('jc_theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setTheme('dark');
    }

    const timer = setInterval(() => {
      setClock(new Date().toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }, 1000);
    setClock(new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));

    return () => clearInterval(timer);
  }, []);

  function toggleTheme() {
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('jc_theme', 'light');
      setTheme('light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('jc_theme', 'dark');
      setTheme('dark');
    }
  }

  // 3. Comprobar estado de conexión con el backend
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setOnline(true);
        } else {
          setOnline(false);
        }
      } catch {
        setOnline(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg, type = 'ok') {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    } finally {
      setUsuario(null);
      showToast('Has cerrado sesión correctamente.', 'ok');
    }
  }

  // Pantalla de carga mientras verifica sesión
  if (authLoading) {
    return (
      <div className="login-screen">
        <div style={{ textAlign: 'center', color: 'var(--ink)' }}>
          <div className="brand-logo-wrap" style={{ display: 'inline-flex', marginBottom: 14, animation: 'pulse 1.5s infinite' }}>
            <img
              src="/logo.png"
              alt="Rentacar JC"
              style={{
                width: 130,
                height: 89,
                display: 'block',
                objectFit: 'cover',
                borderRadius: 15,
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontWeight: 600 }}>Cargando Rentacar JC...</div>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar pantalla de inicio de sesión
  if (!usuario) {
    return (
      <>
        <LoginView
          onLoginSuccess={(u) => {
            setUsuario(u);
            showToast(`¡Bienvenido de nuevo, ${u.nombre || 'Administrador'}!`, 'ok');
          }}
        />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        theme={theme}
        toggleTheme={toggleTheme}
        online={online}
        clock={clock}
        usuario={usuario}
        onLogout={handleLogout}
      />

      <main className="main-content">
        <div className="content-wrap">
          {activeTab === 'vehiculos' && <VehiculosView showToast={showToast} />}
          {activeTab === 'clientes' && <ClientesView showToast={showToast} />}
          {activeTab === 'alquileres' && <AlquileresView showToast={showToast} />}
          {activeTab === 'reservas' && <ReservasView showToast={showToast} />}
          {activeTab === 'pagos' && <PagosView showToast={showToast} />}
          {activeTab === 'gastos' && <GastosView showToast={showToast} />}
          {activeTab === 'estadisticas' && <EstadisticasView showToast={showToast} />}

          <footer className="hint">
            Rentacar JC — Sistema de Administración de Alquiler de Vehículos y Motos
          </footer>
        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
