'use client';

import { useState, useEffect, useCallback } from 'react';
import { estadoLabel } from '@/lib/format';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toISO(anio, mes, dia) {
  const m = String(mes + 1).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${anio}-${m}-${d}`;
}

function generarRangoISO(desde, hasta) {
  if (!desde || !hasta || hasta < desde) return [];
  const res = [];
  const [y1, m1, d1] = desde.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = hasta.slice(0, 10).split('-').map(Number);
  const cur = new Date(Date.UTC(y1, m1 - 1, d1));
  const end = new Date(Date.UTC(y2, m2 - 1, d2));
  let guard = 0;
  while (cur <= end && guard < 366) {
    res.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return res;
}

export default function CalendarioDisponibilidad({
  showToast,
  vehiculoIdForzado = null,
  modoSelector = false,
  fechaInicioSeleccionada = '',
  fechaFinSeleccionada = '',
  onSelectRango = null,
  onValidacionChange = null,
  refreshTrigger = 0,
  onEstadoActualizado = null,
}) {
  const [vehiculos, setVehiculos] = useState([]);
  const [vehiculoId, setVehiculoId] = useState(vehiculoIdForzado || '');
  const [fechaMes, setFechaMes] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [calData, setCalData] = useState(null);
  const [loadingCal, setLoadingCal] = useState(false);

  // Panel de edición de día (disponible / alquilado / mantenimiento)
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [estadoDiaForm, setEstadoDiaForm] = useState('mantenimiento');
  const [fechaFinBloqueo, setFechaFinBloqueo] = useState('');
  const [obsDiaForm, setObsDiaForm] = useState('');
  const [guardandoDia, setGuardandoDia] = useState(false);
  const [cambiandoEstadoVeh, setCambiandoEstadoVeh] = useState(false);

  // Cargar lista de vehículos si no es forzado desde el modal
  useEffect(() => {
    if (vehiculoIdForzado) {
      setVehiculoId(String(vehiculoIdForzado));
      return;
    }
    async function fetchVehiculos() {
      try {
        const res = await fetch('/api/vehiculos');
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setVehiculos(data);
          if (data.length > 0 && !vehiculoId) {
            setVehiculoId(String(data[0].id));
          }
        }
      } catch (err) {
        if (showToast) showToast('Error cargando vehículos del calendario: ' + err.message, 'error');
      }
    }
    fetchVehiculos();
  }, [vehiculoIdForzado, refreshTrigger]);

  const cargarCalendarioVehiculo = useCallback(async (id) => {
    if (!id) {
      setCalData(null);
      return;
    }
    try {
      setLoadingCal(true);
      const res = await fetch(`/api/calendario?vehiculo_id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el calendario');
      setCalData(data);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoadingCal(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (vehiculoId) {
      cargarCalendarioVehiculo(vehiculoId);
      setDiaSeleccionado(null);
    } else {
      setCalData(null);
    }
  }, [vehiculoId, cargarCalendarioVehiculo, refreshTrigger]);

  // Si estamos en modoSelector y cambia fechaInicioSeleccionada, posicionar el mes
  useEffect(() => {
    if (modoSelector && fechaInicioSeleccionada) {
      const [y, m] = fechaInicioSeleccionada.split('-').map(Number);
      if (y && m) {
        setFechaMes(new Date(y, m - 1, 1));
      }
    }
  }, [modoSelector, fechaInicioSeleccionada]);

  // Evaluar conflictos en tiempo real cuando está en modoSelector
  useEffect(() => {
    if (!modoSelector || !onValidacionChange) return;
    if (!calData || !fechaInicioSeleccionada || !fechaFinSeleccionada) {
      onValidacionChange({ disponible: true, conflictos: [], mensaje: '' });
      return;
    }

    const veh = calData.vehiculo;
    if (veh.estado === 'fuera_de_servicio') {
      onValidacionChange({
        disponible: false,
        conflictos: [],
        mensaje: 'Este vehículo está fuera de servicio y no puede alquilarse.',
      });
      return;
    }
    if (veh.estado === 'mantenimiento') {
      onValidacionChange({
        disponible: false,
        conflictos: [],
        mensaje: 'Este vehículo está en estado general de Mantenimiento. Cámbialo a Disponible primero.',
      });
      return;
    }

    const rango = generarRangoISO(fechaInicioSeleccionada, fechaFinSeleccionada);
    const diasEnConflicto = [];

    for (const f of rango) {
      const infoDia = calData.dias_ocupados?.[f];
      if (infoDia && (infoDia.estado === 'alquilado' || infoDia.estado === 'mantenimiento' || infoDia.estado === 'reservado')) {
        diasEnConflicto.push(infoDia);
      }
    }

    if (diasEnConflicto.length > 0) {
      const resumenFechas = diasEnConflicto
        .map((d) => `${d.fecha} (${estadoLabel(d.estado)})`)
        .join(', ');
      onValidacionChange({
        disponible: false,
        conflictos: diasEnConflicto,
        mensaje: `El vehículo ya está ocupado en las fechas seleccionadas: ${resumenFechas}. Elige días que estén en Disponible.`,
      });
    } else {
      onValidacionChange({
        disponible: true,
        conflictos: [],
        mensaje: '',
      });
    }
  }, [modoSelector, calData, fechaInicioSeleccionada, fechaFinSeleccionada, onValidacionChange]);

  function mesAnterior() {
    setFechaMes((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function mesSiguiente() {
    setFechaMes((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function irAHoy() {
    const now = new Date();
    setFechaMes(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  function obtenerEstadoDia(fechaStr) {
    if (!calData) return { estado: 'disponible', detalle: 'Disponible' };
    if (calData.vehiculo?.estado === 'mantenimiento' && !calData.dias_ocupados?.[fechaStr]) {
      return {
        estado: 'mantenimiento',
        origen: 'vehiculo',
        detalle: 'Vehículo en estado general de Mantenimiento',
      };
    }
    const oc = calData.dias_ocupados?.[fechaStr];
    if (oc) return oc;
    return { estado: 'disponible', origen: 'libre', detalle: 'Disponible para alquilar' };
  }

  function handleClickDia(fechaStr) {
    const infoDia = obtenerEstadoDia(fechaStr);

    if (modoSelector && onSelectRango) {
      // Si el usuario hace clic en el calendario dentro del modal de Nuevo Alquiler
      if (!fechaInicioSeleccionada || (fechaInicioSeleccionada && fechaFinSeleccionada && fechaInicioSeleccionada !== fechaFinSeleccionada)) {
        // Primer clic: establece inicio y fin en ese día (1 día)
        const [y, m, d] = fechaStr.split('-').map(Number);
        const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
        onSelectRango(fechaStr, nextDay);
      } else if (fechaStr >= fechaInicioSeleccionada) {
        onSelectRango(fechaInicioSeleccionada, fechaStr);
      } else {
        onSelectRango(fechaStr, fechaInicioSeleccionada);
      }
      return;
    }

    // Modo gestión: abrir editor del día seleccionado
    setDiaSeleccionado({ fecha: fechaStr, ...infoDia });
    setFechaFinBloqueo(fechaStr);
    setEstadoDiaForm(infoDia.estado === 'reservado' ? 'alquilado' : infoDia.estado);
    setObsDiaForm(infoDia.observaciones || '');
  }

  async function guardarEstadoDia(e) {
    e.preventDefault();
    if (!diaSeleccionado || !vehiculoId) return;
    setGuardandoDia(true);

    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'dia',
          vehiculo_id: Number(vehiculoId),
          fecha_inicio: diaSeleccionado.fecha,
          fecha_fin: fechaFinBloqueo >= diaSeleccionado.fecha ? fechaFinBloqueo : diaSeleccionado.fecha,
          estado: estadoDiaForm,
          observaciones: obsDiaForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el día');

      setCalData(data);
      setDiaSeleccionado(null);
      if (showToast) {
        showToast(`Calendario actualizado a "${estadoLabel(estadoDiaForm)}".`, 'ok');
      }
      if (onEstadoActualizado) onEstadoActualizado();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setGuardandoDia(false);
    }
  }

  async function cambiarEstadoGeneralVehiculo(nuevoEstado) {
    if (!vehiculoId) return;
    setCambiandoEstadoVeh(true);
    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'vehiculo',
          vehiculo_id: Number(vehiculoId),
          estado: nuevoEstado,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar el estado del vehículo');

      setCalData(data);
      // Actualizar también en la lista local del selector
      setVehiculos((prev) =>
        prev.map((v) => (String(v.id) === String(vehiculoId) ? { ...v, estado: nuevoEstado } : v))
      );
      if (showToast) {
        showToast(`Estado del vehículo cambiado a ${estadoLabel(nuevoEstado)}.`, 'ok');
      }
      if (onEstadoActualizado) onEstadoActualizado();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setCambiandoEstadoVeh(false);
    }
  }

  const anio = fechaMes.getFullYear();
  const mes = fechaMes.getMonth();
  const primerDiaSemana = (new Date(anio, mes, 1).getDay() + 6) % 7; // Lunes = 0 ... Domingo = 6
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const hoyISO = new Date().toISOString().slice(0, 10);

  const celdasVacias = Array.from({ length: primerDiaSemana }, (_, i) => i);
  const diasArray = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  const vehActual = calData?.vehiculo;

  return (
    <div className={modoSelector ? 'cal-selector-box' : 'card'} style={modoSelector ? { marginTop: '14px' } : { marginBottom: '18px' }}>
      <div className="cal-header-bar">
        <div>
          <h2 style={{ margin: 0, fontSize: modoSelector ? '14px' : '16px' }}>
            📅 Calendario de disponibilidad {vehActual ? `— ${vehActual.codigo} (${vehActual.placa})` : ''}
          </h2>
          <p className="sub" style={{ margin: '2px 0 0' }}>
            {modoSelector
              ? 'Verifica qué días están disponibles (verde) u ocupados (rojo/amarillo). Haz clic en los días para elegir fechas.'
              : 'Consulta qué días están libres, alquilados o en mantenimiento. Haz clic en cualquier día para cambiar su estado.'}
          </p>
        </div>

        <div className="cal-controls-row">
          {!vehiculoIdForzado && (
            <div className="field" style={{ minWidth: '240px', marginBottom: 0 }}>
              <label>Vehículo</label>
              <select
                value={vehiculoId}
                onChange={(e) => setVehiculoId(e.target.value)}
              >
                {vehiculos.length === 0 ? (
                  <option value="">Sin vehículos registrados</option>
                ) : (
                  vehiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.codigo} — {v.marca_modelo} ({v.placa}) [{estadoLabel(v.estado)}]
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {!modoSelector && vehActual && (
            <div className="field" style={{ minWidth: '175px', marginBottom: 0 }}>
              <label>Estado general del vehículo</label>
              <select
                value={vehActual.estado}
                disabled={cambiandoEstadoVeh}
                onChange={(e) => cambiarEstadoGeneralVehiculo(e.target.value)}
              >
                <option value="disponible">🟢 Disponible</option>
                <option value="alquilado">🔴 Alquilado</option>
                <option value="mantenimiento">🟡 Mantenimiento</option>
              </select>
            </div>
          )}

          <div className="cal-month-nav">
            <button type="button" className="btn btn-ghost btn-sm" onClick={mesAnterior} title="Mes anterior">
              ←
            </button>
            <span className="cal-month-title">
              {MESES[mes]} {anio}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={mesSiguiente} title="Mes siguiente">
              →
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={irAHoy}>
              Hoy
            </button>
          </div>
        </div>
      </div>

      {/* Leyenda de estados */}
      <div className="cal-leyenda" style={{ marginTop: '12px' }}>
        <span>
          <span className="cal-dot cal-disponible" /> Disponible
        </span>
        <span>
          <span className="cal-dot cal-alquilado" /> Alquilado
        </span>
        <span>
          <span className="cal-dot cal-mantenimiento" /> Mantenimiento
        </span>
        <span>
          <span className="cal-dot cal-reservado" /> Reservado
        </span>
        {modoSelector && (
          <span>
            <span className="cal-dot cal-seleccionado" /> Fechas seleccionadas
          </span>
        )}
      </div>

      {!vehiculoId ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: '13px' }}>
          Selecciona un vehículo para visualizar su calendario de disponibilidad.
        </div>
      ) : loadingCal && !calData ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-soft)', fontSize: '13px' }}>
          Cargando disponibilidad del vehículo…
        </div>
      ) : (
        <>
          <div className={`cal-grid ${modoSelector ? 'cal-grid-compact' : ''}`}>
            {DIAS_SEMANA.map((dow) => (
              <div key={dow} className="cal-dow">
                {dow}
              </div>
            ))}

            {celdasVacias.map((idx) => (
              <div key={`empty-${idx}`} className="cal-day cal-vacio" />
            ))}

            {diasArray.map((dia) => {
              const fechaStr = toISO(anio, mes, dia);
              const info = obtenerEstadoDia(fechaStr);
              const esHoy = fechaStr === hoyISO;
              const esEditando = diaSeleccionado?.fecha === fechaStr;

              const enRangoSeleccionado =
                modoSelector &&
                fechaInicioSeleccionada &&
                fechaFinSeleccionada &&
                fechaStr >= fechaInicioSeleccionada &&
                fechaStr <= fechaFinSeleccionada;

              const tieneConflictoEnSeleccion =
                enRangoSeleccionado && info.estado !== 'disponible';

              let claseEstado = `cal-${info.estado}`;
              if (tieneConflictoEnSeleccion) {
                claseEstado += ' cal-conflicto-rango';
              } else if (enRangoSeleccionado) {
                claseEstado += ' cal-seleccionado-rango';
              }
              if (esHoy) claseEstado += ' cal-hoy';
              if (esEditando) claseEstado += ' cal-activo-edicion';

              const tagTexto =
                info.estado === 'alquilado'
                  ? 'Alquilado'
                  : info.estado === 'mantenimiento'
                  ? 'Mant.'
                  : info.estado === 'reservado'
                  ? 'Reserva'
                  : 'Libre';

              return (
                <button
                  type="button"
                  key={fechaStr}
                  className={`cal-day ${claseEstado}`}
                  title={`${fechaStr}: ${info.detalle}`}
                  onClick={() => handleClickDia(fechaStr)}
                >
                  <span className="cal-day-num">{dia}</span>
                  <span className="cal-day-tag">{tagTexto}</span>
                </button>
              );
            })}
          </div>

          {/* Panel rápido al hacer clic en un día (en el calendario principal) */}
          {!modoSelector && diaSeleccionado && (
            <form onSubmit={guardarEstadoDia} className="cal-day-editor">
              <div className="cal-day-editor-head">
                <div>
                  <strong>Configurar disponibilidad — {diaSeleccionado.fecha}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                    Estado actual: <strong>{estadoLabel(diaSeleccionado.estado)}</strong> — {diaSeleccionado.detalle}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDiaSeleccionado(null)}
                >
                  ✕
                </button>
              </div>

              <div className="cal-day-editor-grid">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Cambiar estado a *</label>
                  <select
                    value={estadoDiaForm}
                    onChange={(e) => setEstadoDiaForm(e.target.value)}
                  >
                    <option value="disponible">🟢 Disponible</option>
                    <option value="alquilado">🔴 Alquilado</option>
                    <option value="mantenimiento">🟡 Mantenimiento</option>
                  </select>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Aplicar hasta la fecha</label>
                  <input
                    type="date"
                    min={diaSeleccionado.fecha}
                    value={fechaFinBloqueo}
                    onChange={(e) => setFechaFinBloqueo(e.target.value)}
                  />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Motivo / Observación (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Taller cambio de aceite, reservado..."
                    value={obsDiaForm}
                    onChange={(e) => setObsDiaForm(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={guardandoDia}>
                    {guardandoDia ? 'Guardando…' : 'Aplicar estado'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

