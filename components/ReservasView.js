'use client';

import { useState, useEffect } from 'react';
import { fmtCOP, estadoLabel, fmtFecha } from '@/lib/format';

export default function ReservasView({ showToast }) {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState('activa');

  // Modal Nueva Reserva
  const [modalOpen, setModalOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [form, setForm] = useState({
    cliente_id: '',
    vehiculo_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    monto_abono: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function cargarReservas() {
    try {
      setLoading(true);
      const res = await fetch(`/api/reservas?estado=${estado}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar reservas');
      setReservas(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarReservas();
  }, [estado]);

  async function abrirNuevaReserva() {
    setFormError('');
    setForm({
      cliente_id: '',
      vehiculo_id: '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      monto_abono: '',
      observaciones: '',
    });

    try {
      const [resC, resV] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/vehiculos'),
      ]);
      const dataC = await resC.json();
      const dataV = await resV.json();
      setClientes(dataC);
      setVehiculos(dataV);
      setModalOpen(true);
    } catch (err) {
      showToast('Error al preparar formulario: ' + err.message, 'error');
    }
  }

  async function guardarReserva(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar reserva');

      showToast('Reserva creada exitosamente.', 'ok');
      setModalOpen(false);
      setEstado('activa');
      cargarReservas();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function convertirEnAlquiler(id) {
    if (!confirm('¿Deseas convertir esta reserva en un alquiler activo ahora?')) return;
    try {
      const res = await fetch(`/api/reservas/${id}/convertir`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al convertir');

      showToast('Reserva convertida en alquiler activo exitosamente.', 'ok');
      cargarReservas();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function cancelarReserva(id) {
    if (!confirm('¿Estás seguro de cancelar esta reserva?')) return;
    try {
      const res = await fetch(`/api/reservas/${id}/cancelar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar');

      showToast('Reserva cancelada.', 'ok');
      cargarReservas();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="toolbar-left">
          <select className="filter-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="activa">Reservas activas</option>
            <option value="convertida">Convertidas a alquiler</option>
            <option value="vencida">Vencidas</option>
            <option value="cancelada">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevaReserva}>
          + Nueva reserva
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vehículo</th>
              <th>Fecha Inicio</th>
              <th>Fecha Fin</th>
              <th>Abono Inicial</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                  Cargando reservas…
                </td>
              </tr>
            ) : reservas.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  <p>No se encontraron reservas con el filtro seleccionado.</p>
                </td>
              </tr>
            ) : (
              reservas.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.cliente_nombre}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{r.cliente_codigo}</div>
                  </td>
                  <td>
                    <span className="plate" style={{ marginRight: '6px' }}>
                      <span className={`plate-tag ${r.vehiculo_tipo || 'carro'}`} />
                      <span className="plate-num">{r.placa}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{r.marca_modelo}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_inicio)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(r.fecha_fin)}</td>
                  <td><strong>{fmtCOP.format(r.monto_abono)}</strong></td>
                  <td>
                    <span className={`pill ${r.estado === 'activa' ? 'disponible' : r.estado === 'convertida' ? 'alquilado' : 'fuera_de_servicio'}`}>
                      {estadoLabel(r.estado)}
                    </span>
                  </td>
                  <td>
                    <div className="acciones-td">
                      {(r.estado === 'activa' || r.estado === 'vencida') && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => convertirEnAlquiler(r.id)}>
                            Convertir en Alquiler
                          </button>
                          <button className="btn btn-ghost btn-danger btn-sm" onClick={() => cancelarReserva(r.id)}>
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Reserva */}
      {modalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>Nueva reserva</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <p className="sub">Aparta un vehículo para fechas futuras con un abono inicial</p>

            <form onSubmit={guardarReserva}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Cliente *</label>
                  <select
                    required
                    value={form.cliente_id}
                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  >
                    <option value="">Selecciona un cliente…</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} — {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <label>Fecha Inicio *</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_inicio}
                    onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Fecha Fin *</label>
                  <input
                    type="date"
                    required
                    value={form.fecha_fin}
                    onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Monto de Abono (COP) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ej: 50000"
                    value={form.monto_abono}
                    onChange={(e) => setForm({ ...form, monto_abono: e.target.value })}
                  />
                </div>
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Observaciones</label>
                <textarea
                  rows="2"
                  placeholder="Detalles sobre el acuerdo de reserva"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                />
              </div>

              {formError && <div className="form-msg error" style={{ marginTop: '10px' }}>{formError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando reserva…' : 'Crear reserva'}
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
