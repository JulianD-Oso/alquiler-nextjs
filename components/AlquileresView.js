'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmtCOP, fmtFecha, estadoLabel } from '@/lib/format';
import CalendarioDisponibilidad from '@/components/CalendarioDisponibilidad';

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDiasISO(fechaStr, dias) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(dias || 1)));
  return dt.toISOString().slice(0, 10);
}

function diffDiasISO(inicioStr, finStr) {
  if (!inicioStr || !finStr) return 1;
  const [y1, m1, d1] = inicioStr.split('-').map(Number);
  const [y2, m2, d2] = finStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  return Math.max(1, diff);
}

export default function AlquileresView({ showToast }) {
  const [vista, setVista] = useState('activo'); // 'activo' | 'historial'
  const [alquileres, setAlquileres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calRefresh, setCalRefresh] = useState(0);

  // Modal Nuevo Alquiler
  const [modalNuevoOpen, setModalNuevoOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [vehiculosDisponibles, setVehiculosDisponibles] = useState([]);
  const [formNuevo, setFormNuevo] = useState({
    cliente_id: '',
    vehiculo_id: '',
    fecha_entrega: hoyISO(),
    fecha_devolucion_programada: sumarDiasISO(hoyISO(), 1),
    dias: 1,
    observaciones: '',
  });
  const [validacionCal, setValidacionCal] = useState({
    disponible: true,
    conflictos: [],
    mensaje: '',
  });
  const [firmaFile, setFirmaFile] = useState(null);
  const [savingNuevo, setSavingNuevo] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState('');

  // Modal Detalle Alquiler & Abonos
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [pagoForm, setPagoForm] = useState({ monto: '', metodo: 'efectivo', observaciones: '' });
  const [savingPago, setSavingPago] = useState(false);

  async function cargarAlquileres() {
    try {
      setLoading(true);
      if (vista === 'activo') {
        const res = await fetch('/api/alquileres/activos');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cargar alquileres activos');
        setAlquileres(data);
      } else {
        const res = await fetch('/api/alquileres?estado=finalizado');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al cargar historial');
        setAlquileres(data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarAlquileres();
  }, [vista]);

  async function abrirNuevoAlquiler() {
    setErrorNuevo('');
    setFirmaFile(null);
    const hoy = hoyISO();
    setFormNuevo({
      cliente_id: '',
      vehiculo_id: '',
      fecha_entrega: hoy,
      fecha_devolucion_programada: sumarDiasISO(hoy, 1),
      dias: 1,
      observaciones: '',
    });
    setValidacionCal({ disponible: true, conflictos: [], mensaje: '' });

    try {
      const [resC, resV] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/vehiculos'),
      ]);
      const dataC = await resC.json();
      const dataV = await resV.json();
      setClientes(dataC);
      setVehiculosDisponibles(
        Array.isArray(dataV) ? dataV.filter((v) => v.estado !== 'fuera_de_servicio') : []
      );
      setModalNuevoOpen(true);
    } catch (err) {
      showToast('Error al preparar formulario: ' + err.message, 'error');
    }
  }

  function handleFechaEntregaChange(nuevaEntrega) {
    let nuevaDev = formNuevo.fecha_devolucion_programada;
    if (!nuevaDev || nuevaDev <= nuevaEntrega) {
      nuevaDev = sumarDiasISO(nuevaEntrega, formNuevo.dias || 1);
    }
    const nuevosDias = diffDiasISO(nuevaEntrega, nuevaDev);
    setFormNuevo({
      ...formNuevo,
      fecha_entrega: nuevaEntrega,
      fecha_devolucion_programada: nuevaDev,
      dias: nuevosDias,
    });
  }

  function handleFechaDevolucionChange(nuevaDev) {
    const entrega = formNuevo.fecha_entrega || hoyISO();
    const finValida = nuevaDev < entrega ? entrega : nuevaDev;
    const nuevosDias = diffDiasISO(entrega, finValida);
    setFormNuevo({
      ...formNuevo,
      fecha_devolucion_programada: finValida,
      dias: nuevosDias,
    });
  }

  function handleDiasChange(val) {
    const diasNum = Math.max(1, parseInt(val, 10) || 1);
    const entrega = formNuevo.fecha_entrega || hoyISO();
    const nuevaDev = sumarDiasISO(entrega, diasNum);
    setFormNuevo({
      ...formNuevo,
      dias: val,
      fecha_devolucion_programada: nuevaDev,
    });
  }

  const handleSelectRangoCalendario = useCallback((inicio, fin) => {
    const nuevosDias = diffDiasISO(inicio, fin);
    setFormNuevo((prev) => ({
      ...prev,
      fecha_entrega: inicio,
      fecha_devolucion_programada: fin,
      dias: nuevosDias,
    }));
  }, []);

  async function guardarNuevoAlquiler(e) {
    e.preventDefault();
    if (!validacionCal.disponible) {
      setErrorNuevo(validacionCal.mensaje || 'El vehículo no está disponible en las fechas seleccionadas.');
      return;
    }

    setSavingNuevo(true);
    setErrorNuevo('');

    try {
      const formData = new FormData();
      formData.append('cliente_id', formNuevo.cliente_id);
      formData.append('vehiculo_id', formNuevo.vehiculo_id);
      formData.append('fecha_entrega', formNuevo.fecha_entrega);
      formData.append('fecha_devolucion_programada', formNuevo.fecha_devolucion_programada);
      formData.append('dias', formNuevo.dias);
      if (formNuevo.observaciones) formData.append('observaciones', formNuevo.observaciones);
      if (firmaFile) formData.append('firma', firmaFile);

      const res = await fetch('/api/alquileres', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear alquiler');

      showToast('Alquiler creado exitosamente.', 'ok');
      setModalNuevoOpen(false);
      setVista('activo');
      setCalRefresh((r) => r + 1);
      cargarAlquileres();
    } catch (err) {
      setErrorNuevo(err.message);
    } finally {
      setSavingNuevo(false);
    }
  }

  async function verDetalle(id) {
    setCargandoDetalle(true);
    setModalDetalleOpen(true);
    setPagoForm({ monto: '', metodo: 'efectivo', observaciones: '' });

    try {
      const res = await fetch(`/api/alquileres/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar detalle');
      setDetalle(data);
    } catch (err) {
      showToast(err.message, 'error');
      setModalDetalleOpen(false);
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();
    if (!detalle) return;
    setSavingPago(true);

    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alquiler_id: detalle.id,
          monto: Number(pagoForm.monto),
          metodo: pagoForm.metodo,
          observaciones: pagoForm.observaciones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar abono');

      showToast('Abono registrado correctamente.', 'ok');
      verDetalle(detalle.id);
      cargarAlquileres();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingPago(false);
    }
  }

  async function finalizarAlquiler(id) {
    if (!confirm('¿Deseas finalizar este alquiler y liberar el vehículo a disponible?')) return;
    try {
      const res = await fetch(`/api/alquileres/${id}/finalizar`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al finalizar');
      showToast('Alquiler finalizado correctamente.', 'ok');
      if (modalDetalleOpen) setModalDetalleOpen(false);
      setCalRefresh((r) => r + 1);
      cargarAlquileres();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Tarifa seleccionada para calcular total en vivo
  const vehiculoSeleccionado = vehiculosDisponibles.find((v) => String(v.id) === String(formNuevo.vehiculo_id));
  const totalEstimado = vehiculoSeleccionado ? vehiculoSeleccionado.precio_dia * Number(formNuevo.dias || 1) : 0;

  return (
    <>
      <CalendarioDisponibilidad
        showToast={showToast}
        refreshTrigger={calRefresh}
        onEstadoActualizado={cargarAlquileres}
      />

      <div className="card">
        <div className="toolbar">
        <div className="toolbar-left">
          <select className="filter-select" value={vista} onChange={(e) => setVista(e.target.value)}>
            <option value="activo">Alquileres activos</option>
            <option value="historial">Historial de finalizados</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevoAlquiler}>
          + Nuevo alquiler
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vehículo</th>
              <th>Entrega</th>
              <th>Devolución</th>
              <th>Días</th>
              <th>Valor Total</th>
              {vista === 'activo' && <th>Pagado</th>}
              {vista === 'activo' && <th>Saldo Pendiente</th>}
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '30px' }}>
                  Cargando alquileres…
                </td>
              </tr>
            ) : alquileres.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <p>{vista === 'activo' ? 'No hay alquileres activos en este momento.' : 'No hay historial de alquileres finalizados.'}</p>
                </td>
              </tr>
            ) : (
              alquileres.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.cliente_nombre}</strong>
                    {a.cliente_codigo && <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{a.cliente_codigo}</div>}
                  </td>
                  <td>
                    <span className="plate" style={{ marginRight: '6px' }}>
                      <span className={`plate-tag ${a.vehiculo_tipo || 'carro'}`} />
                      <span className="plate-num">{a.placa}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{a.marca_modelo}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(a.fecha_entrega)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(a.fecha_devolucion_programada)}</td>
                  <td>{a.dias}</td>
                  <td><strong>{fmtCOP.format(a.precio_total)}</strong></td>
                  {vista === 'activo' && <td>{fmtCOP.format(a.total_pagado || 0)}</td>}
                  {vista === 'activo' && (
                    <td>
                      {Number(a.saldo_pendiente) > 0 ? (
                        <span className="saldo-pendiente">{fmtCOP.format(a.saldo_pendiente)}</span>
                      ) : (
                        <span className="saldo-ok">Al día</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div className="acciones-td">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(a.id)}>
                        Detalle / Abono
                      </button>
                      {vista === 'activo' && (
                        <button className="btn btn-ghost btn-danger btn-sm" onClick={() => finalizarAlquiler(a.id)}>
                          Finalizar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nuevo Alquiler */}
      {modalNuevoOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalNuevoOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '680px' }}>
            <div className="modal-head">
              <h2>Nuevo alquiler</h2>
              <button className="modal-close" onClick={() => setModalNuevoOpen(false)}>✕</button>
            </div>
            <p className="sub">Selecciona el vehículo y las fechas para verificar que los días estén disponibles y no se dupliquen</p>

            <form onSubmit={guardarNuevoAlquiler}>
              <div className="form-grid cols-2">
                <div className="field">
                  <label>Cliente *</label>
                  <select
                    required
                    value={formNuevo.cliente_id}
                    onChange={(e) => setFormNuevo({ ...formNuevo, cliente_id: e.target.value })}
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
                    value={formNuevo.vehiculo_id}
                    onChange={(e) => setFormNuevo({ ...formNuevo, vehiculo_id: e.target.value })}
                  >
                    <option value="">Selecciona un vehículo…</option>
                    {vehiculosDisponibles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.codigo} — {v.marca_modelo} ({v.placa}) — {fmtCOP.format(v.precio_dia)}/día [{estadoLabel(v.estado)}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Fecha de Entrega *</label>
                  <input
                    type="date"
                    required
                    value={formNuevo.fecha_entrega}
                    onChange={(e) => handleFechaEntregaChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Fecha de Devolución *</label>
                  <input
                    type="date"
                    required
                    min={formNuevo.fecha_entrega}
                    value={formNuevo.fecha_devolucion_programada}
                    onChange={(e) => handleFechaDevolucionChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Número de Días *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formNuevo.dias}
                    onChange={(e) => handleDiasChange(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Total Estimado</label>
                  <input
                    disabled
                    style={{ fontWeight: 'bold', color: 'var(--primary)' }}
                    value={fmtCOP.format(totalEstimado)}
                  />
                </div>
              </div>

              {formNuevo.vehiculo_id && (
                <CalendarioDisponibilidad
                  showToast={showToast}
                  vehiculoIdForzado={formNuevo.vehiculo_id}
                  modoSelector={true}
                  fechaInicioSeleccionada={formNuevo.fecha_entrega}
                  fechaFinSeleccionada={formNuevo.fecha_devolucion_programada}
                  onSelectRango={handleSelectRangoCalendario}
                  onValidacionChange={setValidacionCal}
                  refreshTrigger={calRefresh}
                />
              )}

              {!validacionCal.disponible && (
                <div className="cal-alert-conflict" style={{ marginTop: '12px' }}>
                  ⚠️ <strong>Días no disponibles:</strong> {validacionCal.mensaje}
                </div>
              )}

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Firma digital / Comprobante de acuerdo (imagen)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFirmaFile(e.target.files[0])}
                />
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Observaciones</label>
                <textarea
                  rows="2"
                  placeholder="Detalles sobre entrega, combustible, etc."
                  value={formNuevo.observaciones}
                  onChange={(e) => setFormNuevo({ ...formNuevo, observaciones: e.target.value })}
                />
              </div>

              {errorNuevo && <div className="form-msg error" style={{ marginTop: '10px' }}>{errorNuevo}</div>}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingNuevo || !validacionCal.disponible}
                >
                  {savingNuevo ? 'Creando alquiler…' : 'Crear alquiler'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalNuevoOpen(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Alquiler & Abonos */}
      {modalDetalleOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setModalDetalleOpen(false); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2>Detalle del alquiler</h2>
              <button className="modal-close" onClick={() => setModalDetalleOpen(false)}>✕</button>
            </div>

            {cargandoDetalle || !detalle ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Cargando información del acuerdo…</div>
            ) : (
              <div>
                <div className="detalle-grid">
                  <span className="k">Cliente</span>
                  <span className="v">{detalle.cliente_nombre} ({detalle.cliente_codigo})</span>
                  <span className="k">Vehículo</span>
                  <span className="v">{detalle.marca_modelo} — {detalle.placa}</span>
                  <span className="k">Entrega</span>
                  <span className="v">{fmtFecha(detalle.fecha_entrega)}</span>
                  <span className="k">Devolución programada</span>
                  <span className="v">{fmtFecha(detalle.fecha_devolucion_programada)}</span>
                  <span className="k">Días pactados</span>
                  <span className="v">{detalle.dias}</span>
                  <span className="k">Valor total</span>
                  <span className="v">{fmtCOP.format(detalle.precio_total)}</span>
                  <span className="k">Total pagado</span>
                  <span className="v">{fmtCOP.format(detalle.total_pagado)}</span>
                  <span className="k">Saldo pendiente</span>
                  <span className="v">
                    {Number(detalle.saldo_pendiente) > 0 ? (
                      <span className="saldo-pendiente">{fmtCOP.format(detalle.saldo_pendiente)}</span>
                    ) : (
                      <span className="saldo-ok">Pagado por completo</span>
                    )}
                  </span>
                  <span className="k">Estado</span>
                  <span className="v">
                    <span className={`pill ${detalle.estado === 'activo' ? 'disponible' : 'fuera_de_servicio'}`}>
                      {detalle.estado === 'activo' ? 'Activo' : 'Finalizado'}
                    </span>
                  </span>
                </div>

                <div className="detalle-seccion-titulo">Firma del acuerdo</div>
                {detalle.firma_archivo ? (
                  <img className="firma-preview" src={detalle.firma_archivo} alt="Firma del acuerdo" />
                ) : (
                  <p className="sin-firma">Sin firma adjunta todavía.</p>
                )}

                <div className="detalle-seccion-titulo">Historial de abonos</div>
                {detalle.pagos && detalle.pagos.length > 0 ? (
                  <table style={{ marginTop: '8px' }}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Método</th>
                        <th>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.pagos.map((p) => (
                        <tr key={p.id}>
                          <td>{fmtFecha(p.fecha_pago)}</td>
                          <td><strong>{fmtCOP.format(p.monto)}</strong></td>
                          <td style={{ textTransform: 'capitalize' }}>{p.metodo || '—'}</td>
                          <td>{p.observaciones || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="sin-firma">No se han registrado abonos todavía.</p>
                )}

                {detalle.estado === 'activo' && Number(detalle.saldo_pendiente) > 0 && (
                  <form onSubmit={registrarPago} className="pago-form-inline" style={{ marginTop: '16px' }}>
                    <div className="field">
                      <label>Monto a abonar (COP)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max={detalle.saldo_pendiente}
                        placeholder={`Máx ${detalle.saldo_pendiente}`}
                        value={pagoForm.monto}
                        onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Método</label>
                      <select
                        value={pagoForm.metodo}
                        onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Nota / Ref</label>
                      <input
                        placeholder="Ej: Transferencia Bancolombia"
                        value={pagoForm.observaciones}
                        onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={savingPago} style={{ marginBottom: 0 }}>
                      {savingPago ? 'Guardando…' : 'Registrar abono'}
                    </button>
                  </form>
                )}

                {detalle.estado === 'activo' && (
                  <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                    <button
                      className="btn btn-danger"
                      onClick={() => finalizarAlquiler(detalle.id)}
                    >
                      Finalizar alquiler y recibir vehículo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
