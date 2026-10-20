# Rentacar JC — Sistema Administrativo Fullstack en Next.js

Sistema integral de gestión y administración de alquiler de motos y carros para **Rentacar JC**, migrado a **Next.js 16 (App Router)** y optimizado para despliegue sin servidor en **Vercel**.

---

## 🚀 Características y Módulos Migrados

1. **Vehículos**: Control de flota (motos y carros), placas personalizadas, tarifas por día, estados automáticos y manuales (disponible, alquilado, mantenimiento, fuera de servicio).
2. **Clientes**: Registro con código incremental automático (`CL01`, `CL02`), validación de licencias y buscador en tiempo real.
3. **Alquileres**: Creación de acuerdos con cálculo automático de tarifas, soporte de firmas digitales (Vercel Blob o Base64) y control de saldo pendiente vs pagado.
4. **Reservas**: Bloqueo anticipado de fechas con validación anti-solapamiento y conversión automática a alquiler activo con un solo clic.
5. **Control de Pagos**: Panel enfocado en cartera pendiente y registro inmediato de abonos parciales o totales.
6. **Gastos Operativos**: Categorización de costos (mantenimiento, gasolina, seguros, impuestos, otro) vinculados a cada vehículo.
7. **Estadísticas y Reportes**:
   - Tarjetas de resumen en tiempo real (flota disponible, alquilada, clientes, cartera por cobrar).
   - Balance mensual (contratado, cobrado, gastos, ganancia neta y gráfico por tipo de vehículo).
   - Balance anual con gráfico mes a mes.
   - Rentabilidad individual por vehículo y cliente.
8. **Diseño Premium**: Paleta oficial de Rentacar JC, soporte completo para tema claro y oscuro con persistencia, reloj en vivo y barra lateral colapsable.

---

## 🛠️ Ejecución Local

Para correr el proyecto localmente con Bun:

```bash
cd alquiler-nextjs
bun install
bun run dev --port 3001
```

Abre tu navegador en [http://localhost:3001](http://localhost:3001).

> **Nota sobre base de datos local:**
> Si no defines la variable `DATABASE_URL`, el sistema usará automáticamente la base de datos local SQLite (`data/alquiler.db`), por lo que no necesitas configurar nada para probarlo en tu máquina.

---

## ☁️ Despliegue en Vercel (Paso a Paso)

### Paso 1: Crear Base de Datos en la Nube (Gratis en 1 Clic con Neon Postgres)

Vercel utiliza funciones serverless (sin disco persistente), por lo que la base de datos debe residir en la nube:

1. Ve a [neon.tech](https://neon.tech) (o en el Marketplace de Vercel seleccionando **Neon** o **Vercel Postgres**).
2. Crea un proyecto nuevo (Plan gratuito sin tarjeta de crédito).
3. Copia tu cadena de conexión `DATABASE_URL` (ejemplo: `postgresql://usuario:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).

### Paso 2: Inicializar las Tablas en la Nube

En tu terminal local, ejecuta el script de inicialización con tu URL de Neon:

```bash
cd alquiler-nextjs
DATABASE_URL="postgresql://tu-url-de-neon..." bun run db:init
```

Verás el mensaje: `✅ Esquema creado exitosamente en PostgreSQL (tablas, índices y vistas)`.

### Paso 3: Subir a GitHub y Conectar con Vercel

1. Sube la carpeta `alquiler-nextjs` a tu repositorio de GitHub.
2. Ingresa a [vercel.com](https://vercel.com) y haz clic en **"Add New Project"**.
3. Importa tu repositorio.
4. En la sección **Environment Variables**, agrega:
   - `DATABASE_URL`: Tu cadena de conexión copiada en el Paso 1.
   - *(Opcional)* `BLOB_READ_WRITE_TOKEN`: Si habilitas **Vercel Blob** en la pestaña *Storage* de Vercel para guardar firmas como archivos en la nube (si no lo configuras, el sistema guarda las firmas en Base64 automáticamente sin error).
5. Haz clic en **Deploy**.

¡Listo! En menos de 1 minuto tendrás tu panel administrativo publicado en `https://tu-proyecto.vercel.app`.

---

## 📁 Estructura del Proyecto

```
alquiler-nextjs/
├── app/
│   ├── api/                     # Route Handlers de Next.js
│   │   ├── vehiculos/           # GET, POST, PUT, DELETE
│   │   ├── clientes/            # GET, POST, PUT, DELETE
│   │   ├── alquileres/          # GET, POST, detalle, finalizar
│   │   ├── reservas/            # GET, POST, convertir, cancelar
│   │   ├── pagos/               # POST registrar abonos
│   │   ├── gastos/              # GET, POST, DELETE
│   │   ├── estadisticas/        # resumen, mensual, anual, vehiculo, cliente
│   │   └── health/              # GET status
│   ├── globals.css              # Sistema de diseño de Rentacar JC (Dark/Light)
│   ├── layout.js                # Layout base y metadatos SEO
│   └── page.js                  # Dashboard principal
├── components/                  # Vistas modulares en React
│   ├── Sidebar.js
│   ├── ToastContainer.js
│   ├── VehiculosView.js
│   ├── ClientesView.js
│   ├── AlquileresView.js
│   ├── ReservasView.js
│   ├── PagosView.js
│   ├── GastosView.js
│   └── EstadisticasView.js
├── lib/
│   ├── db.js                    # Adaptador universal (Postgres / Neon / SQLite)
│   ├── format.js                # Formateo COP y etiquetas
│   ├── codigos.js               # Generación incremental (M01, CR01, CL01)
│   ├── errors.js                # Traducción de errores a español
│   └── storage.js               # Almacenamiento serverless (Vercel Blob / Base64)
├── scripts/
│   └── init-postgres.js         # Script para crear tablas en PostgreSQL/Neon
└── .env.example                 # Plantilla de variables de entorno
```
