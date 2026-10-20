'use client';

import { useState, useEffect } from 'react';
import { fmtCOP, estadoLabel } from '@/lib/format';

export default function VehiculosView({ showToast }) {
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    tipo: 'carro',
    marca_modelo: '',
    placa: '',
    anio: '',
    precio_dia: '',
    estado: 'disponible',
    propietario_nombre: '',
    propietario_identificacion: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function cargarVehiculos() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (tipo) params.set('tipo', tipo);
      if (estado) params.set('estado', estado);

      const res = await fetch(`/api/vehiculos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar vehículos');
      setVehiculos(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarVehiculos();
  }, [q, tipo, estado]);

  function abrirNuevo() {
    setEditingId(null);
    setForm({
      tipo: 'carro',
      marca_modelo: '',
      placa: '',
      anio: '',
      precio_dia: '',
      estado: 'disponible',
      propietario_nombre: '',
      propietario_identificacion: '',
      observaciones: '',
    });
    setFormError('');
    setModalOpen(true);
  }

  function abrirEditar(v) {
    setEditingId(v.id);
    setForm({
      tipo: v.tipo,
      marca_modelo: v.marca_modelo,
      placa: v.placa,
      anio: v.anio || '',
      precio_dia: v.precio_dia,
      estado: v.estado,
      propietario_nombre: v.propietario_nombre || '',
      propietario_identificacion: v.propietario_identificacion || '',
      observaciones: v.observaciones || '',
    });
    setFormError('');
    setModalOpen(true);
  }

  async function guardarVehiculo(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const url = editingId ? `/api/vehiculos/${editingId}` : '/api/vehiculos';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      showToast(editingId ? 'Vehículo actualizado.' : 'Vehículo registrado exitosamente.', 'ok');
      setModalOpen(false);
      cargarVehiculos();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarVehiculo(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este vehículo?')) return;
    try {
      const res = await fetch(`/api/vehiculos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');
      showToast('Vehículo eliminado.', 'ok');
      cargarVehiculos();
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
              placeholder="Buscar vehículo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="filter-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="carro">Carros</option>
            <option value="moto">Motos</option>
          </select>
          <select className="filter-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="alquilado">Alquilado</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          + Nuevo vehículo
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Marca / Modelo</th>
              <th>Placa</th>
              <th>Año</th>
              <th>Tarifa/Día</th>
              <th>Estado</th>
              <th>Propietario</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>
                  Cargando vehículos…
                </td>
              </tr>
            ) : vehiculos.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <p>No se encontraron vehículos.</p>
                </td>
              </tr>
            ) : (
              vehiculos.map((v) => (
                <tr key={v.id}>
                  <td><span className="codigo-badge">{v.codigo}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{v.tipo}</td>
                  <td>{v.marca_modelo}</td>
                  <td>
                    <span className="plate">
                      <span className={`plate-tag ${v.tipo}`} />
                      <span className="plate-num">{v.placa}</span>
                    </span>
                  </td>
                  <td>{v.anio || '—'}</td>
                  <td>{fmtCOP.format(v.precio_dia)}</td>
                  <td><span className={`pill ${v.estado}`}>{estadoLabel(v.estado)}</span></td>
                  <td>{v.propietario_nombre || <span style={{ color: 'var(--ink-soft)' }}>Empresa</span>}</td>
                  <td>
                    <div className="acciones-td">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(v)}>Editar</button>
                      <button className="btn btn-ghost btn-danger btn-sm" onClick={() => eliminarVehiculo(v.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Vehículo */}
      {modalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>{editingId ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <p className="sub">{editingId ? 'Modifica los datos del vehículo seleccionado' : 'El código interno se generará automáticamente'}</p>

            <form onSubmit={guardarVehiculo}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Tipo *</label>
                  <select
                    disabled={!!editingId}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  >
                    <option value="carro">Carro</option>
                    <option value="moto">Moto</option>
                  </select>
                </div>
                <div className="field">
                  <label>Placa *</label>
                  <input
                    className="mono-input"
                    required
                    placeholder="Ej: ABC123"
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="field">
                  <label>Marca y Modelo *</label>
                  <input
                    required
                    placeholder="Ej: Chevrolet Spark GT"
                    value={form.marca_modelo}
                    onChange={(e) => setForm({ ...form, marca_modelo: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Año</label>
                  <input
                    type="number"
                    placeholder="Ej: 2022"
                    value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Tarifa por día (COP) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 120000"
                    value={form.precio_dia}
                    onChange={(e) => setForm({ ...form, precio_dia: e.target.value })}
                  />
                </div>
                {editingId && (
                  <div className="field">
                    <label>Estado</label>
                    <select
                      value={form.estado}
                      disabled={form.estado === 'alquilado'}
                      onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    >
                      <option value="disponible">Disponible</option>
                      <option value="mantenimiento">Mantenimiento</option>
                      <option value="fuera_de_servicio">Fuera de servicio</option>
                      {form.estado === 'alquilado' && <option value="alquilado">Alquilado (gestionado en alquileres)</option>}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>Propietario (si es tercero)</label>
                  <input
                    placeholder="Nombre completo"
                    value={form.propietario_nombre}
                    onChange={(e) => setForm({ ...form, propietario_nombre: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Identificación del Propietario</label>
                  <input
                    placeholder="Cédula / NIT"
                    value={form.propietario_identificacion}
                    onChange={(e) => setForm({ ...form, propietario_identificacion: e.target.value })}
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: '14px' }}>
                <label>Observaciones</label>
                <textarea
                  rows="2"
                  placeholder="Detalles adicionales, equipamiento, etc."
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                />
              </div>

              {formError && <div className="form-msg error" style={{ marginTop: '10px' }}>{formError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar vehículo'}
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
