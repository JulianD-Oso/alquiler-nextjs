'use client';

import { useState, useEffect } from 'react';
import { fmtCOP } from '@/lib/format';

export default function PagosView({ showToast }) {
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Pago
  const [modalOpen, setModalOpen] = useState(false);
  const [alquilerSeleccionado, setAlquilerSeleccionado] = useState(null);
  const [pagoForm, setPagoForm] = useState({ monto: '', metodo: 'efectivo', observaciones: '' });
  const [saving, setSaving] = useState(false);

  async function cargarPendientes() {
    try {
      setLoading(true);
      const res = await fetch('/api/alquileres/activos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar alquileres');
      // Filtra solo los que tienen saldo pendiente > 0
      setPendientes(data.filter((a) => Number(a.saldo_pendiente) > 0));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarPendientes();
  }, []);

  function abrirCobro(a) {
    setAlquilerSeleccionado(a);
    setPagoForm({ monto: a.saldo_pendiente, metodo: 'efectivo', observaciones: '' });
    setModalOpen(true);
  }

  async function registrarPago(e) {
    e.preventDefault();
    if (!alquilerSeleccionado) return;
    setSaving(true);

    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alquiler_id: alquilerSeleccionado.id,
          monto: Number(pagoForm.monto),
          metodo: pagoForm.metodo,
          observaciones: pagoForm.observaciones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar abono');

      showToast('Abono registrado con éxito.', 'ok');
      setModalOpen(false);
      cargarPendientes();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const totalPorCobrar = pendientes.reduce((acc, a) => acc + Number(a.saldo_pendiente || 0), 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2>Control de Pagos y Cartera Pendiente</h2>
          <p className="sub">Alquileres activos que registran saldo pendiente por cobrar</p>
        </div>
        <div className="stat-card" style={{ minWidth: '220px', padding: '10px 16px' }}>
          <div className="label">Total pendiente por cobrar</div>
          <div className="value red">{fmtCOP.format(totalPorCobrar)}</div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vehículo</th>
              <th>Fecha Entrega</th>
              <th>Valor Total</th>
              <th>Total Pagado</th>
              <th>Saldo Pendiente</th>
              <th style={{ textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '30px' }}>
                  Consultando cartera pendiente…
                </td>
              </tr>
            ) : pendientes.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  <p>🎉 ¡Excelente! Todos los alquileres activos están al día sin saldos pendientes.</p>
                </td>
              </tr>
            ) : (
              pendientes.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.cliente_nombre}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{a.cliente_codigo}</div>
                  </td>
                  <td>
                    <span className="plate" style={{ marginRight: '6px' }}>
                      <span className={`plate-tag ${a.vehiculo_tipo || 'carro'}`} />
                      <span className="plate-num">{a.placa}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{a.marca_modelo}</span>
                  </td>
                  <td>{new Date(a.fecha_entrega).toLocaleDateString('es-CO')}</td>
                  <td>{fmtCOP.format(a.precio_total)}</td>
                  <td>{fmtCOP.format(a.total_pagado || 0)}</td>
                  <td>
                    <span className="saldo-pendiente">{fmtCOP.format(a.saldo_pendiente)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => abrirCobro(a)}>
                      Registrar Cobro
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Registrar Cobro */}
      {modalOpen && alquilerSeleccionado && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>Registrar cobro / abono</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <p className="sub">
              Cliente: <strong>{alquilerSeleccionado.cliente_nombre}</strong> — Vehículo: <strong>{alquilerSeleccionado.placa}</strong>
            </p>

            <form onSubmit={registrarPago}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Monto a recibir (COP) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={alquilerSeleccionado.saldo_pendiente}
                    value={pagoForm.monto}
                    onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                  />
                  <small style={{ color: 'var(--ink-soft)', fontSize: '11px' }}>
                    Saldo pendiente total: {fmtCOP.format(alquilerSeleccionado.saldo_pendiente)}
                  </small>
                </div>
                <div className="field">
                  <label>Método de Pago *</label>
                  <select
                    value={pagoForm.metodo}
                    onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia bancaria</option>
                    <option value="tarjeta">Tarjeta débito/crédito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Notas / Referencia</label>
                <input
                  placeholder="Número de comprobante o referencia de pago"
                  value={pagoForm.observaciones}
                  onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registrando cobro…' : 'Confirmar cobro'}
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
