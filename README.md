# Rutina en casa 🔥

PWA en español, estilo Duolingo, para ser constante con una rutina de ejercicios en casa.
HTML + CSS + JS vanilla, sin backend, sin cuentas, sin build. Los datos viven en `localStorage`.

## Probar en local

Los service workers necesitan `http://localhost` (no funcionan abriendo el archivo con `file://`):

```bash
python -m http.server 8000      # o: npx serve .
```

Abre http://localhost:8000. Para probar la lógica de la racha: `node test-logic.js`.
Para regenerar los iconos: `node make-icons.js`.

## Publicar gratis

**GitHub Pages**
1. Crea un repositorio nuevo en GitHub y sube todos los archivos de esta carpeta.
2. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
3. En 1-2 minutos tendrás la app en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

**Netlify**
1. Entra a https://app.netlify.com/drop (con cuenta gratuita).
2. Arrastra la carpeta del proyecto a la página.
3. Te da una URL `https://algo.netlify.app`. Puedes cambiar el nombre en *Site settings*.

Ambos sirven por HTTPS, requisito para instalar la PWA y usar el service worker. Si actualizas archivos, sube la versión de `CACHE` en `sw.js` para que el iPhone descargue lo nuevo.

## Instalar en el iPhone

1. Abre la URL publicada en **Safari** (tiene que ser Safari).
2. Toca **Compartir** (cuadrado con flecha) → **Agregar a pantalla de inicio** → **Agregar**.
3. Abre la app desde el icono nuevo. Funciona sin conexión.

## Recordatorios: límites en iOS

Una PWA sin servidor push **no puede** programar notificaciones fiables en iOS. La app notifica a tu hora solo si está abierta. Por eso incluye:
- Un aviso dentro de la app, al abrirla, si hoy no has entrenado.
- Una guía paso a paso en **Ajustes** para crear una automatización diaria en **Atajos de iOS**.

## Trayecto

La pestaña **Trayecto** es un camino de 23 lecciones en 4 unidades (de «Primer paso» a «Rutina completa»), con una lección jefe al final de cada unidad. Cada lección es una sesión: la siguiente se desbloquea al completar al menos el 80% de las series. El modo mínimo y las sesiones parciales cuentan para la racha, pero no avanzan el trayecto. Al terminar, se sigue con la rutina A/B. Se puede apagar en Ajustes. La intensidad (RIR) baja de 5 a 2 a lo largo de las unidades.

## Otras funciones

- **Descanso activo:** los días sin entrenamiento puedes registrar una caminata de 20 min. Suma a la racha, pero no a la meta semanal. La pantalla Hoy recomienda cada día si te toca entrenar o caminar, para repartir la meta semanal.
- **Registro tardío:** si ayer entrenaste y olvidaste registrarlo, puedes marcarlo desde el aviso de Hoy (solo ayer).
- **Logros:** 22 insignias por hitos (rachas, unidades, primera flexión, semanas perfectas…). Se calculan desde el historial y no se pierden.
- **Semanas perfectas:** semanas seguidas cumpliendo la meta.
- **Peso y cintura:** registro semanal con gráfico en Progreso.
- **Durante el entrenamiento:** calentamiento opcional, cronómetro para la plancha, pantalla encendida, salto automático al siguiente ejercicio y aviso de cuándo subir la carga.
- **Bienvenida:** al abrir por primera vez, define tu gatillo («después de…») y tu hora.

## Reglas de la racha

- El día cambia a medianoche en `America/Santiago`; la aritmética de días no depende del horario de verano.
- Un día cuenta si entrenaste (rutina, lección o modo mínimo), si registraste una caminata o si lo congelaste.
- Congelador: máx. 2 por mes, solo para ayer o antes de ayer, y solo si el día previo estaba cubierto. El día congelado mantiene la racha pero no suma.
- Metas: semanas 1-3 → 2 sesiones; desde la semana 4 → 3 (semana lunes a domingo).
- El modo mínimo no avanza la rotación A/B ni afecta a «última vez».

## Respaldo

**Ajustes → Respaldo**: exporta a `.json`, copia al portapapeles o importa. Si borras los datos de Safari se pierde todo, así que exporta de vez en cuando.
