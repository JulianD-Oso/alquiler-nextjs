'use client';

import { useState, useEffect } from 'react';
import { fmtCOP, CATEGORIAS_GASTO_LABEL, fmtFecha } from '@/lib/format';

export default function GastosView({ showToast }) {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');

  // Modal Nuevo Gasto
  const [modalOpen, setModalOpen] = useState(false);
  const [vehiculos, setVehiculos] = useState([]);
  const [form, setForm] = useState({
    vehiculo_id: '',
    categoria: 'mantenimiento',
    monto: '',
    fecha_gasto: '',
    descripcion: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function cargarGastos() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoria) params.set('categoria', categoria);
      if (vehiculoId) params.set('vehiculo_id', vehiculoId);

      const res = await fetch(`/api/gastos?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar gastos');
      setGastos(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function cargarVehiculosFiltro() {
    try {
      const res = await fetch('/api/vehiculos');
      const data = await res.json();
      setVehiculos(data);
    } catch {
      // ignorar
    }
  }

  useEffect(() => {
    cargarVehiculosFiltro();
  }, []);

  useEffect(() => {
    cargarGastos();
  }, [categoria, vehiculoId]);

  function abrirNuevoGasto() {
    setFormError('');
    setForm({
      vehiculo_id: vehiculos[0]?.id || '',
      categoria: 'mantenimiento',
      monto: '',
      fecha_gasto: new Date().toISOString().slice(0, 10),
      descripcion: '',
    });
    setModalOpen(true);
  }

  async function guardarGasto(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar gasto');

      showToast('Gasto registrado exitosamente.', 'ok');
      setModalOpen(false);
      cargarGastos();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarGasto(id) {
    if (!confirm('¿Deseas eliminar este registro de gasto?')) return;
    try {
      const res = await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      showToast('Gasto eliminado.', 'ok');
      cargarGastos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto || 0), 0);

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="filter-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="gasolina">Gasolina</option>
            <option value="seguro">Seguro</option>
            <option value="impuestos">Impuestos</option>
            <option value="otro">Otro</option>
          </select>
          <select className="filter-select" value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
            <option value="">Todos los vehículos</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.codigo} — {v.marca_modelo} ({v.placa})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            Total gastos: <span style={{ color: 'var(--red)' }}>{fmtCOP.format(totalGastos)}</span>
          </div>
          <button className="btn btn-primary" onClick={abrirNuevoGasto}>
            + Registrar gasto
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Vehículo</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                  Cargando gastos…
                </td>
              </tr>
            ) : gastos.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <p>No se encontraron registros de gastos.</p>
                </td>
              </tr>
            ) : (
              gastos.map((g) => (
                <tr key={g.id}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{fmtFecha(g.fecha_gasto)}</td>
                  <td>
                    <span className="plate" style={{ marginRight: '6px' }}>
                      <span className={`plate-tag ${g.vehiculo_tipo || 'carro'}`} />
                      <span className="plate-num">{g.placa}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{g.marca_modelo}</span>
                  </td>
                  <td>
                    <span className={`pill ${g.categoria}`}>
                      {CATEGORIAS_GASTO_LABEL[g.categoria] || g.categoria}
                    </span>
                  </td>
                  <td>{g.descripcion || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td><strong style={{ color: 'var(--red)' }}>{fmtCOP.format(g.monto)}</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-danger btn-sm" onClick={() => eliminarGasto(g.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Gasto */}
      {modalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>Registrar gasto</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <p className="sub">Asocia un costo operativo o de mantenimiento a un vehículo de la flota</p>

            <form onSubmit={guardarGasto}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Vehículo *</label>
                  <select
                    required
                    value={form.vehiculo_id}
                    onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })}
                  >
                    <option value="">Selecciona un vehículo…</option>
                    {vehiculos.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.codigo} — {v.marca_modelo} ({v.placa})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Categoría *</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  >
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="gasolina">Gasolina</option>
                    <option value="seguro">Seguro (SOAT, Todo Riesgo)</option>
                    <option value="impuestos">Impuestos</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="field">
                  <label>Monto (COP) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 80000"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Fecha del Gasto *</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_gasto}
                    onChange={(e) => setForm({ ...form, fecha_gasto: e.target.value })}
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Descripción / Detalle</label>
                <textarea
                  rows="2"
                  placeholder="Detalles sobre el repuesto, servicio, taller, etc."
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>

              {formError && <div className="form-msg error" style={{ marginTop: '10px' }}>{formError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registrando…' : 'Registrar gasto'}
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
