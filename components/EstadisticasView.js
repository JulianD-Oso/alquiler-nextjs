'use client';

import { useState, useEffect } from 'react';
import { fmtCOP, CATEGORIAS_GASTO_LABEL, MESES_CORTO } from '@/lib/format';

export default function EstadisticasView({ showToast }) {
  // Top summary
  const [resumen, setResumen] = useState(null);

  // Mensual
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [mes, setMes] = useState(currentMonth);
  const [anioMensual, setAnioMensual] = useState(currentYear);
  const [datosMensual, setDatosMensual] = useState(null);

  // Anual
  const [anioAnual, setAnioAnual] = useState(currentYear);
  const [datosAnual, setDatosAnual] = useState(null);

  // Por vehículo & cliente
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculoId, setVehiculoId] = useState('');
  const [vehiculoStats, setVehiculoStats] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [clienteStats, setClienteStats] = useState(null);

  async function cargarResumen() {
    try {
      const res = await fetch('/api/estadisticas/resumen');
      const data = await res.json();
      setResumen(data);
    } catch (err) {
      showToast('Error cargando resumen: ' + err.message, 'error');
    }
  }

  async function consultarMensual() {
    try {
      const res = await fetch(`/api/estadisticas/mensual?mes=${mes}&anio=${anioMensual}`);
      const data = await res.json();
      setDatosMensual(data);
    } catch (err) {
      showToast('Error en reporte mensual: ' + err.message, 'error');
    }
  }

  async function consultarAnual() {
    try {
      const res = await fetch(`/api/estadisticas/anual?anio=${anioAnual}`);
      const data = await res.json();
      setDatosAnual(data);
    } catch (err) {
      showToast('Error en reporte anual: ' + err.message, 'error');
    }
  }

  async function cargarVehiculosYClientes() {
    try {
      const [resV, resC] = await Promise.all([
        fetch('/api/vehiculos'),
        fetch('/api/clientes'),
      ]);
      setVehiculos(await resV.json());
      setClientes(await resC.json());
    } catch {
      // ignorar
    }
  }

  useEffect(() => {
    cargarResumen();
    cargarVehiculosYClientes();
  }, []);

  useEffect(() => {
    consultarMensual();
  }, [mes, anioMensual]);

  useEffect(() => {
    consultarAnual();
  }, [anioAnual]);

  useEffect(() => {
    if (!vehiculoId) {
      setVehiculoStats(null);
      return;
    }
    fetch(`/api/estadisticas/vehiculo/${vehiculoId}`)
      .then((r) => r.json())
      .then((d) => setVehiculoStats(d))
      .catch((e) => showToast(e.message, 'error'));
  }, [vehiculoId]);

  useEffect(() => {
    if (!clienteId) {
      setClienteStats(null);
      return;
    }
    fetch(`/api/estadisticas/cliente/${clienteId}`)
      .then((r) => r.json())
      .then((d) => setClienteStats(d))
      .catch((e) => showToast(e.message, 'error'));
  }, [clienteId]);

  return (
    <div>
      {/* Top Stat Cards */}
      {resumen && (
        <div className="stat-grid top-stats">
          <div className="stat-card">
            <div className="label">Total Flota</div>
            <div className="value">{resumen.total_vehiculos}</div>
          </div>
          <div className="stat-card">
            <div className="label">Alquilados</div>
            <div className="value primary">{resumen.vehiculos_alquilados}</div>
          </div>
          <div className="stat-card">
            <div className="label">Disponibles</div>
            <div className="value green">{resumen.vehiculos_disponibles}</div>
          </div>
          <div className="stat-card">
            <div className="label">Mantenimiento</div>
            <div className="value gold">{resumen.vehiculos_mantenimiento}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Clientes</div>
            <div className="value">{resumen.total_clientes}</div>
          </div>
          <div className="stat-card">
            <div className="label">Cartera por Cobrar</div>
            <div className="value red">{fmtCOP.format(resumen.total_por_cobrar)}</div>
          </div>
        </div>
      )}

      <div className="stats-dashboard-grid">
        {/* Reporte Mensual */}
        <div className="card">
          <h2>Reporte Mensual</h2>
          <p className="sub">Balance financiero y operativo por mes</p>

          <div className="stats-controls">
            <div className="field">
              <label>Mes</label>
              <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {MESES_CORTO.map((nom, i) => (
                  <option key={i + 1} value={i + 1}>
                    {nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Año</label>
              <input
                type="number"
                value={anioMensual}
                onChange={(e) => setAnioMensual(Number(e.target.value))}
              />
            </div>
          </div>

          {datosMensual && datosMensual.resumen && (
            <div>
              <div className="detalle-grid" style={{ marginTop: '14px', marginBottom: '14px' }}>
                <span className="k">Alquileres iniciados</span>
                <span className="v">{datosMensual.resumen.total_alquileres}</span>
                <span className="k">Valor contratado</span>
                <span className="v">{fmtCOP.format(datosMensual.resumen.valor_contratado)}</span>
                <span className="k">Ingresos cobrados</span>
                <span className="v green">{fmtCOP.format(datosMensual.resumen.ingresos_cobrados)}</span>
                <span className="k">Gastos operativos</span>
                <span className="v red">{fmtCOP.format(datosMensual.resumen.gastos_totales)}</span>
                <span className="k" style={{ fontWeight: 'bold' }}>Ganancia neta</span>
                <span
                  className="v"
                  style={{
                    fontWeight: 'bold',
                    color: datosMensual.resumen.ganancia_neta >= 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {fmtCOP.format(datosMensual.resumen.ganancia_neta)}
                </span>
              </div>

              {/* Gráficos de barras */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)' }}>
                  Alquileres por tipo de vehículo
                </div>
                {datosMensual.por_tipo && datosMensual.por_tipo.length > 0 ? (
                  <div className="bars">
                    {datosMensual.por_tipo.map((t, idx) => {
                      const maxVal = Math.max(...datosMensual.por_tipo.map((p) => Number(p.valor_contratado) || 1));
                      const pct = Math.max(8, Math.round((Number(t.valor_contratado) / maxVal) * 100));
                      return (
                        <div key={idx} className="bar-col">
                          <div className="bar" style={{ height: `${pct}%` }} />
                          <span className="bar-label" style={{ textTransform: 'capitalize' }}>{t.tipo}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="chart-empty">Sin alquileres en este mes.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reporte Anual */}
        <div className="card">
          <h2>Reporte Anual</h2>
          <p className="sub">Evolución mensual durante el año seleccionado</p>

          <div className="stats-controls">
            <div className="field">
              <label>Año</label>
              <input
                type="number"
                value={anioAnual}
                onChange={(e) => setAnioAnual(Number(e.target.value))}
              />
            </div>
          </div>

          {datosAnual && datosAnual.total && (
            <div>
              <div className="detalle-grid" style={{ marginTop: '14px', marginBottom: '14px' }}>
                <span className="k">Total alquileres</span>
                <span className="v">{datosAnual.total.total_alquileres}</span>
                <span className="k">Total contratado</span>
                <span className="v">{fmtCOP.format(datosAnual.total.valor_contratado)}</span>
                <span className="k">Total gastos</span>
                <span className="v red">{fmtCOP.format(datosAnual.total.gastos_totales)}</span>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-soft)', marginTop: '14px' }}>
                Alquileres mes a mes
              </div>
              <div className="bars">
                {datosAnual.por_mes?.map((m) => {
                  const maxQty = Math.max(1, ...datosAnual.por_mes.map((x) => x.cantidad));
                  const pct = m.cantidad > 0 ? Math.max(10, Math.round((m.cantidad / maxQty) * 100)) : 4;
                  return (
                    <div key={m.mes} className="bar-col" title={`${MESES_CORTO[m.mes - 1]}: ${m.cantidad} alquileres`}>
                      <div className="bar gold" style={{ height: `${pct}%` }} />
                      <span className="bar-label">{MESES_CORTO[m.mes - 1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rentabilidad por Vehículo */}
        <div className="card">
          <h2>Rentabilidad por Vehículo</h2>
          <p className="sub">Ingresos generados vs costos de mantenimiento</p>

          <div className="field" style={{ maxWidth: '380px' }}>
            <label>Selecciona un vehículo</label>
            <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
              <option value="">Seleccionar vehículo…</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.codigo} — {v.marca_modelo} ({v.placa})
                </option>
              ))}
            </select>
          </div>

          {vehiculoStats && (
            <div className="detalle-grid" style={{ marginTop: '16px' }}>
              <span className="k">Total alquileres</span>
              <span className="v">{vehiculoStats.total_alquileres}</span>
              <span className="k">Ingresos contratados</span>
              <span className="v green">{fmtCOP.format(vehiculoStats.ingresos_contratados)}</span>
              <span className="k">Gastos totales</span>
              <span className="v red">{fmtCOP.format(vehiculoStats.gastos_totales)}</span>
              <span className="k" style={{ fontWeight: 'bold' }}>Ganancia neta</span>
              <span
                className="v"
                style={{
                  fontWeight: 'bold',
                  color: vehiculoStats.ganancia_neta >= 0 ? 'var(--green)' : 'var(--red)',
                }}
              >
                {fmtCOP.format(vehiculoStats.ganancia_neta)}
              </span>
            </div>
          )}
        </div>

        {/* Rendimiento por Cliente */}
        <div className="card">
          <h2>Historial de Cliente</h2>
          <p className="sub">Frecuencia y valor total contratado por cliente</p>

          <div className="field" style={{ maxWidth: '380px' }}>
            <label>Selecciona un cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Seleccionar cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {clienteStats && (
            <div className="detalle-grid" style={{ marginTop: '16px' }}>
              <span className="k">Total alquileres realizados</span>
              <span className="v">{clienteStats.total_alquileres}</span>
              <span className="k">Valor contratado acumulado</span>
              <span className="v green">{fmtCOP.format(clienteStats.valor_contratado)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
