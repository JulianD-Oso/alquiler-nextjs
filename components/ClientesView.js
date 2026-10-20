'use client';

import { useState, useEffect } from 'react';

export default function ClientesView({ showToast }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    identificacion: '',
    telefono: '',
    tiene_licencia: true,
    direccion: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function cargarClientes() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);

      const res = await fetch(`/api/clientes?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar clientes');
      setClientes(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarClientes();
  }, [q]);

  function abrirNuevo() {
    setEditingId(null);
    setForm({
      nombre: '',
      identificacion: '',
      telefono: '',
      tiene_licencia: true,
      direccion: '',
    });
    setFormError('');
    setModalOpen(true);
  }

  function abrirEditar(c) {
    setEditingId(c.id);
    setForm({
      nombre: c.nombre,
      identificacion: c.identificacion || '',
      telefono: c.telefono || '',
      tiene_licencia: c.tiene_licencia ?? true,
      direccion: c.direccion || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function guardarCliente(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const url = editingId ? `/api/clientes/${editingId}` : '/api/clientes';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      showToast(editingId ? 'Cliente actualizado.' : 'Cliente registrado exitosamente.', 'ok');
      setModalOpen(false);
      cargarClientes();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCliente(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      showToast('Cliente eliminado.', 'ok');
      cargarClientes();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente por nombre o CC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo cliente
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Identificación</th>
              <th>Teléfono</th>
              <th>Licencia</th>
              <th>Dirección</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                  Cargando clientes…
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  <p>No se encontraron clientes.</p>
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id}>
                  <td><span className="codigo-badge">{c.codigo}</span></td>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{c.identificacion || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td>{c.telefono || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td>
                    {c.tiene_licencia === true ? (
                      <span className="pill si">Sí</span>
                    ) : c.tiene_licencia === false ? (
                      <span className="pill no">No</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{c.direccion || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td>
                    <div className="acciones-td">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(c)}>Editar</button>
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => eliminarCliente(c.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Cliente */}
      {modalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <p className="sub">{editingId ? 'Actualiza los datos del cliente' : 'El código se asignará automáticamente'}</p>

            <form onSubmit={guardarCliente}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Nombre completo *</label>
                  <input
                    required
                    placeholder="Ej: Carlos Mario Gómez"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Documento de Identificación</label>
                  <input
                    placeholder="Cédula, Pasaporte, etc."
                    value={form.identificacion}
                    onChange={(e) => setForm({ ...form, identificacion: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="Ej: 300 123 4567"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Dirección</label>
                  <input
                    placeholder="Ciudad, barrio o dirección"
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>
              </div>

              <div className="field checkbox" style={{ marginTop: '12px' }}>
                <input
                  type="checkbox"
                  id="chk-licencia"
                  checked={form.tiene_licencia}
                  onChange={(e) => setForm({ ...form, tiene_licencia: e.target.checked })}
                />
                <label htmlFor="chk-licencia">El cliente cuenta con licencia de conducción vigente</label>
              </div>

              {formError && <div className="form-msg error" style={{ marginTop: '10px' }}>{formError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar cliente'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
