/* =====================================================================
   Rutina en casa — app.js
   Parte 1: LÓGICA PURA (fechas, racha, metas). No toca el DOM y se puede
            probar en Node (ver test-logic.js).
   Parte 2: INTERFAZ (solo corre en el navegador).
   Todas las fechas son claves "YYYY-MM-DD" del día local en America/Santiago.
   ===================================================================== */
(function () {
  'use strict';

  const TZ = 'America/Santiago';
  const MAX_FREEZES = 2;          // congeladores por mes
  const FREEZE_WINDOW = 2;        // se puede congelar ayer o antepasado
  const LS_KEY = 'rutina.v1';

  /* ------------------------------ Fechas ------------------------------ */
  const pad = (n) => String(n).padStart(2, '0');
  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  /** Día local en Santiago de un instante. Cambia exactamente a la medianoche local. */
  function dayKey(date) {
    const p = {};
    dayFmt.formatToParts(date || new Date()).forEach((x) => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}`;
  }
  /** "HH:MM" local en Santiago. */
  const hmNow = (date) => hmFmt.format(date || new Date());

  // La aritmética de días se hace en UTC sobre la fecha "pelada": así los cambios de
  // horario (DST) nunca saltan ni repiten un día, porque UTC no tiene DST.
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const toKey = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const addDays = (k, n) => toKey(parseKey(k) + n * 86400000);
  const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
  const dowMon0 = (k) => (new Date(parseKey(k)).getUTCDay() + 6) % 7;   // lunes = 0
  const weekStart = (k) => addDays(k, -dowMon0(k));
  const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

  /* --------------------------- Rutinas y datos --------------------------- */
  const ROUTINES = {
    A: { title: 'Día A · Empuje y core', exercises: [
      { id: 'flexiones', name: 'Flexiones', sets: 3, target: '8-15', def: 8 },
      { id: 'sentadilla', name: 'Sentadilla con mochila', sets: 3, target: '12-15', def: 12 },
      { id: 'remo', name: 'Remo con mochila o mancuerna', sets: 3, target: '10-12', def: 10 },
      { id: 'press', name: 'Press de hombros', sets: 3, target: '10-12', def: 10 },
      { id: 'plancha', name: 'Plancha', sets: 3, target: '30-45 seg', def: 30, unit: 'seg' }
    ] },
    B: { title: 'Día B · Piernas y espalda', exercises: [
      { id: 'fondos', name: 'Fondos en silla', sets: 3, target: '10-15', def: 10 },
      { id: 'zancadas', name: 'Zancadas', sets: 3, target: '10 por pierna', def: 10 },
      { id: 'remo-inv', name: 'Remo invertido bajo una mesa', sets: 3, target: 'máx.', def: 6 },
      { id: 'puente', name: 'Puente de glúteos', sets: 3, target: '15', def: 15 },
      { id: 'elev-piernas', name: 'Elevaciones de piernas', sets: 3, target: '12', def: 12 }
    ] }
  };
  const MINIMAL = { title: 'Modo mínimo · 5 min', exercises: [
    { id: 'flexiones', name: 'Flexiones', sets: 1, target: '10', def: 10 },
    { id: 'sentadilla', name: 'Sentadillas', sets: 1, target: '10', def: 10 }
  ] };
  const EX = {};
  [ROUTINES.A, ROUTINES.B].forEach((r) => r.exercises.forEach((e) => { EX[e.id] = e; }));

  const defaultSettings = () => ({ time: '20:00', notify: false, rest: 75, path: true, anchor: '' });
  function defaultState(today) {
    return { v: 1, startDate: today, sessions: {}, freezes: {}, draft: null, settings: defaultSettings(), lastNotified: null,
      body: {}, lastBackup: null, onboarded: false };
  }
  /** sessions[k] = { type, minimal:bool, ex:{id:[reps|null,...]}, lesson?, partial? } ; freezes[k] = true
      type: 'A' | 'B' (rutina) · 'P' (lección del trayecto) · 'W' (descanso activo: caminata)
            · 'R' (entrenamiento registrado después, sin detalle).
      Todas cuentan para la racha; la caminata ('W') no cuenta para la meta semanal.
      body[k] = { kg, cm } (peso y cintura). */

  /* ------------------------------- Racha ------------------------------- */
  const covered = (st, k) => !!(st.sessions[k] || st.freezes[k]);

  /** Días entrenados en la cadena ininterrumpida que termina en `anchor`.
      Un día congelado mantiene la cadena pero no suma. */
  function streakEndingAt(st, anchor) {
    let n = 0, k = anchor;
    while (covered(st, k)) { if (st.sessions[k]) n++; k = addDays(k, -1); }
    return n;
  }

  /** Mejor racha histórica (misma regla de cadena). */
  function bestStreak(st) {
    const keys = Array.from(new Set([...Object.keys(st.sessions), ...Object.keys(st.freezes)])).sort();
    let run = 0, best = 0, prev = null;
    for (const k of keys) {
      if (prev !== null && diffDays(k, prev) !== 1) run = 0;
      if (st.sessions[k]) run++;
      best = Math.max(best, run);
      prev = k;
    }
    return best;
  }

  const freezesUsed = (st, ym) => Object.keys(st.freezes).filter((k) => k.startsWith(ym)).length;
  const freezesLeft = (st, ym) => Math.max(0, MAX_FREEZES - freezesUsed(st, ym));

  /** ¿Se puede congelar el día k? Debe ser pasado reciente, sin entrenar, con el día anterior
      cubierto (si no, la racha ya estaba rota) y quedar cupo en el mes de k. */
  function canFreeze(st, k, today) {
    if (k >= today || diffDays(today, k) > FREEZE_WINDOW) return false;
    if (covered(st, k)) return false;
    if (!covered(st, addDays(k, -1))) return false;
    return freezesUsed(st, k.slice(0, 7)) < MAX_FREEZES;
  }

  /** Estado completo de la racha para la pantalla principal. */
  function streakInfo(st, today) {
    const y = addDays(today, -1);
    const doneToday = !!st.sessions[today];
    const coveredToday = covered(st, today);
    const lost = !coveredToday && !covered(st, y);           // ayer se perdió y hoy aún no cubre
    const streak = coveredToday ? streakEndingAt(st, today) : covered(st, y) ? streakEndingAt(st, y) : 0;
    const wouldBe = lost ? streakEndingAt(st, addDays(y, -1)) : 0;  // racha que se salvaría congelando ayer
    return {
      streak, doneToday, coveredToday, lost,
      best: Math.max(bestStreak(st), streak),
      missedYesterday: !covered(st, y) && st.startDate < today && !doneToday,
      rescuable: lost && wouldBe > 0 && canFreeze(st, y, today),
      rescueStreak: wouldBe
    };
  }

  /* -------------------------- Metas y progresión -------------------------- */
  const firstDay = (st) => Object.keys(st.sessions).concat(st.startDate).sort()[0];
  /** Semana (lunes a domingo) de uso, empezando en 1. */
  const weekNumber = (st, ws) => diffDays(ws, weekStart(firstDay(st))) / 7 + 1;
  /** Semanas 1-3: 2 sesiones; desde la 4: 3. */
  const weekGoal = (st, ws) => (weekNumber(st, ws) >= 4 ? 3 : 2);

  function sessionReps(s) {      // repeticiones totales (la plancha va en segundos y no suma)
    let t = 0;
    for (const id in s.ex) {
      if (EX[id] && EX[id].unit === 'seg') continue;
      (s.ex[id] || []).forEach((n) => { if (typeof n === 'number') t += n; });
    }
    return t;
  }
  function weekStats(st, ws) {
    let sessions = 0, reps = 0;
    for (let i = 0; i < 7; i++) {
      const s = st.sessions[addDays(ws, i)];
      if (s && isTraining(s)) { sessions++; reps += sessionReps(s); }
    }
    return { sessions, reps };
  }
  const isTraining = (s) => s.type !== 'W';
  /** A/B alterna según las sesiones A/B completas (mínimo, lecciones, caminatas y registros no la avanzan). */
  const nextType = (st) => (Object.values(st.sessions).filter((s) => (s.type === 'A' || s.type === 'B') && !s.minimal).length % 2 === 0 ? 'A' : 'B');

  /** Repeticiones de la última sesión completa que incluyó el ejercicio. */
  function lastReps(st, id) {
    const keys = Object.keys(st.sessions).sort().reverse();
    for (const k of keys) {
      const s = st.sessions[k];
      if (!s.minimal && s.ex[id] && s.ex[id].some((n) => typeof n === 'number')) return s.ex[id];
    }
    return null;
  }

  /* ------------------------------ Trayecto ------------------------------ */
  // Ejercicios extra del trayecto (los de las rutinas A/B ya están en EX).
  [
    { id: 'sent-aire', name: 'Sentadilla sin peso' },
    { id: 'flex-pared', name: 'Flexiones en la pared' },
    { id: 'flex-incl', name: 'Flexiones inclinadas (manos en silla o mesa)' },
    { id: 'flex-rod', name: 'Flexiones con rodillas apoyadas' },
    { id: 'plancha-rod', name: 'Plancha con rodillas apoyadas', unit: 'seg' },
    { id: 'plancha-lat', name: 'Plancha lateral + rotación' },
    { id: 'superman', name: 'Superman alternado' },
    { id: 'abd-talones', name: 'Abdominal tocando talones' },
    { id: 'peso-muerto', name: 'Peso muerto con mochila' },
    { id: 'elev-talones', name: 'Elevación de talones' },
    { id: 'puente-peso', name: 'Puente de glúteos con mochila' },
    { id: 'curl', name: 'Curl de bíceps con mochila' },
    { id: 'bulgara', name: 'Sentadilla búlgara' }
  ].forEach((e) => { EX[e.id] = e; });

  /** "flexiones:3x8" = 3 series de 8. Sufijo: s = segundos, p = por pierna, l = por lado. */
  function parseEx(spec) {
    const m = /^([\w-]+):(\d+)x(\d+)([spl]?)$/.exec(spec);
    if (!m || !EX[m[1]]) throw new Error('Ejercicio mal definido: ' + spec);
    const suffix = { s: ' seg', p: ' por pierna', l: ' por lado', '': '' }[m[4]];
    return Object.assign({}, EX[m[1]], { sets: +m[2], target: m[3] + suffix, def: +m[3], unit: m[4] === 's' ? 'seg' : EX[m[1]].unit });
  }

  // Cuatro unidades: de cero hasta la rutina completa. `rir` = repeticiones en reserva
  // (bajan con el tiempo: 5 → 2). Cada unidad termina con una lección "jefe".
  // Con 2 sesiones/semana al inicio y 3 desde la semana 4, el trayecto dura ~8-9 semanas.
  const UNITS_RAW = [
    { title: 'Primer paso', sub: 'Mueve el cuerpo sin miedo', rir: 5, lessons: [
      ['Despierta el cuerpo', 10, 'sent-aire:2x10', 'flex-pared:2x8', 'plancha-rod:2x15s', 'puente:2x10'],
      ['Segundo round', 12, 'sent-aire:2x12', 'flex-pared:2x10', 'superman:2x10', 'plancha-rod:2x20s'],
      ['Mochila ligera', 15, 'sentadilla:2x10', 'flex-incl:2x6', 'remo:2x10', 'puente:2x12'],
      ['Un poco más', 16, 'sentadilla:2x12', 'flex-incl:2x8', 'remo:2x10', 'superman:2x12', 'plancha-rod:2x25s'],
      ['Tres series', 18, 'sentadilla:3x10', 'flex-incl:3x8', 'remo:3x10', 'puente:3x12', 'plancha-rod:2x30s'],
      ['Jefe: Unidad 1', 20, 'sentadilla:3x12', 'flex-incl:3x10', 'remo:3x10', 'superman:3x12', 'plancha-rod:3x30s']
    ] },
    { title: 'Construyendo base', sub: 'Más series y nuevos ejercicios', rir: 4, lessons: [
      ['Flexiones de rodillas', 18, 'flex-rod:3x6', 'sentadilla:3x12', 'remo:3x10', 'press:2x8', 'plancha-rod:3x25s'],
      ['Primeras zancadas', 20, 'flex-rod:3x8', 'zancadas:2x6p', 'remo:3x12', 'press:3x8', 'plancha:3x15s'],
      ['Bisagra de cadera', 22, 'flex-rod:3x10', 'zancadas:3x6p', 'peso-muerto:3x10', 'press:3x10', 'plancha:3x20s'],
      ['Flexiones de verdad', 22, 'flexiones:3x4', 'sentadilla:3x15', 'remo:3x12', 'abd-talones:3x12', 'plancha:3x25s'],
      ['Ganando ritmo', 24, 'flexiones:3x6', 'zancadas:3x8p', 'peso-muerto:3x12', 'press:3x10', 'superman:3x12'],
      ['Jefe: Unidad 2', 25, 'flexiones:3x8', 'sentadilla:3x15', 'remo:3x12', 'press:3x12', 'plancha:3x30s']
    ] },
    { title: 'Fuerza', sub: 'Hombros, espalda y pecho', rir: 3, lessons: [
      ['Más fuerza', 25, 'flexiones:3x8', 'fondos:3x8', 'remo:3x12', 'puente-peso:3x12', 'plancha:3x25s'],
      ['Tu primera dominada', 26, 'flexiones:3x10', 'zancadas:3x8p', 'remo-inv:3x4', 'elev-talones:3x15', 'abd-talones:3x15'],
      ['Brazos y cadera', 28, 'fondos:3x10', 'peso-muerto:3x12', 'curl:3x12', 'press:3x12', 'plancha-lat:3x8l'],
      ['Una pierna a la vez', 30, 'flexiones:3x12', 'bulgara:3x6p', 'remo-inv:3x5', 'puente-peso:3x15', 'superman:3x15'],
      ['Casi completo', 30, 'flexiones:3x12', 'fondos:3x12', 'remo:3x15', 'zancadas:3x10p', 'plancha:3x35s'],
      ['Jefe: Unidad 3', 32, 'flexiones:3x12', 'sentadilla:3x15', 'remo-inv:3x6', 'press:3x12', 'plancha-lat:3x10l']
    ] },
    { title: 'Rutina completa', sub: 'Full body 3 días a la semana', rir: 2, lessons: [
      ['Día A completo', 35, 'flexiones:3x10', 'sentadilla:3x15', 'remo:3x12', 'press:3x12', 'plancha:3x40s'],
      ['Día B completo', 35, 'fondos:3x12', 'zancadas:3x10p', 'remo-inv:3x6', 'puente-peso:3x15', 'elev-piernas:3x12'],
      ['Día A+', 40, 'flexiones:4x10', 'bulgara:3x8p', 'remo:4x12', 'press:3x12', 'plancha-lat:3x10l'],
      ['Día B+', 40, 'fondos:4x12', 'peso-muerto:4x12', 'remo-inv:4x6', 'curl:3x12', 'elev-piernas:3x15'],
      ['Jefe: Unidad 4', 45, 'flexiones:4x12', 'bulgara:3x10p', 'remo-inv:4x8', 'press:4x12', 'plancha:3x45s']
    ] }
  ];
  const UNITS = UNITS_RAW.map((u, ui) => ({
    n: ui + 1, title: u.title, sub: u.sub, rir: u.rir,
    lessons: u.lessons.map((l, i) => ({
      id: `${ui + 1}.${i + 1}`, unit: ui + 1, title: l[0], minutes: l[1], boss: i === u.lessons.length - 1, exercises: l.slice(2).map(parseEx)
    }))
  }));
  const LESSONS = UNITS.reduce((a, u) => a.concat(u.lessons), []);
  const LESSON_BY_ID = {};
  LESSONS.forEach((l) => { LESSON_BY_ID[l.id] = l; });

  /** Lecciones superadas: sesión completa de esa lección (ni parcial ni modo mínimo). */
  function completedLessons(st) {
    const done = new Set();
    for (const k in st.sessions) { const s = st.sessions[k]; if (s.lesson && !s.partial && !s.minimal) done.add(s.lesson); }
    return done;
  }
  const nextLesson = (st) => { const d = completedLessons(st); return LESSONS.find((l) => !d.has(l.id)) || null; };
  /** Qué toca hoy: la siguiente lección del trayecto, o A/B si está apagado o ya lo terminaste. */
  function todayPlan(st) {
    const l = st.settings.path !== false ? nextLesson(st) : null;
    return l ? { type: 'P', lesson: l.id } : { type: nextType(st) };
  }
  /** Rutina ({title, exercises}) para {minimal, type, lesson}. */
  const routineFor = (o) => (o.minimal ? MINIMAL : o.lesson ? LESSON_BY_ID[o.lesson] : ROUTINES[o.type]);

  /* ----------------------- Recomendación del día ----------------------- */
  /** 'done' | 'train' | 'rest'. Reparte la meta semanal (2-3 sesiones) dejando días de descanso
      activo entre medio: si ayer entrenaste y aún llegas a la meta entrenando día por medio
      desde mañana, hoy toca caminar. Si ya cumpliste la meta, también. */
  function dayAdvice(st, today) {
    if (st.sessions[today]) return 'done';
    const ws = weekStart(today), need = weekGoal(st, ws) - weekStats(st, ws).sessions;
    if (need <= 0) return 'rest';
    const y = st.sessions[addDays(today, -1)];
    const trainedYesterday = !!y && isTraining(y) && !y.minimal;
    const daysAfterToday = 6 - dowMon0(today);
    return trainedYesterday && need <= Math.ceil(daysAfterToday / 2) ? 'rest' : 'train';
  }

  /* ------------------------- Semanas perfectas ------------------------- */
  const weekMet = (st, ws) => weekStats(st, ws).sessions >= weekGoal(st, ws);
  /** Semanas seguidas cumpliendo la meta. La semana en curso suma si ya se cumplió, y no corta si aún no. */
  function perfectWeeks(st, today) {
    const first = weekStart(firstDay(st));
    let ws = weekStart(today), n = weekMet(st, ws) ? 1 : 0;
    for (ws = addDays(ws, -7); ws >= first && weekMet(st, ws); ws = addDays(ws, -7)) n++;
    return n;
  }
  function bestPerfectWeeks(st, today) {
    const cur = weekStart(today);
    let best = 0, run = 0;
    for (let ws = weekStart(firstDay(st)); ws <= cur; ws = addDays(ws, 7)) {
      if (weekMet(st, ws)) best = Math.max(best, ++run);
      else if (ws < cur) run = 0;
    }
    return best;
  }

  /* ------------------------------ Logros ------------------------------ */
  // Se calculan desde el historial (no se guardan) y solo usan medidas que nunca bajan,
  // así un logro no se "pierde" si se rompe la racha.
  function achievementCtx(st, today) {
    const entries = Object.entries(st.sessions).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const full = entries.filter(([, s]) => isTraining(s) && !s.minimal);
    const maxReps = (id) => full.reduce((m, [, s]) => Math.max(m, ...((s.ex && s.ex[id]) || []).filter((n) => typeof n === 'number')), 0);
    const first = entries.length ? entries[0][0] : null;
    return {
      best: bestStreak(st), training: entries.filter(([, s]) => isTraining(s)).length,
      minimal: entries.filter(([, s]) => s.minimal).length, walks: entries.filter(([, s]) => s.type === 'W').length,
      lessons: completedLessons(st), reps: entries.reduce((a, [, s]) => a + sessionReps(s), 0),
      freezes: Object.keys(st.freezes).length, pushups: maxReps('flexiones'), rows: maxReps('remo-inv'),
      weeks: bestPerfectWeeks(st, today),
      comeback: entries.some(([k]) => { const p = addDays(k, -1); return p > first && !covered(st, p); })
    };
  }
  const bossOf = (n) => UNITS[n - 1].lessons[UNITS[n - 1].lessons.length - 1].id;
  const ACHIEVEMENTS = [
    ['primera', '🌱', 'Primer paso', 'Tu primera sesión de entrenamiento', (c) => c.training >= 1],
    ['minimo', '⚡', 'Mínimo pero cuenta', 'Usaste el modo mínimo para no romper la cadena', (c) => c.minimal >= 1],
    ['regreso', '💙', 'El regreso', 'Volviste después de un día perdido. Eso es lo que importa', (c) => c.comeback],
    ['racha3', '🔥', 'En marcha', 'Racha de 3 días', (c) => c.best >= 3],
    ['racha7', '🔥', 'Una semana', 'Racha de 7 días', (c) => c.best >= 7],
    ['racha14', '🔥', 'Dos semanas', 'Racha de 14 días', (c) => c.best >= 14],
    ['racha30', '🏅', 'Un mes de hábito', 'Racha de 30 días', (c) => c.best >= 30],
    ['racha100', '💯', 'Triple dígito', 'Racha de 100 días', (c) => c.best >= 100],
    ['racha365', '👑', 'Un año', 'Racha de 365 días', (c) => c.best >= 365],
    ['semana', '📅', 'Semana perfecta', 'Cumpliste la meta semanal', (c) => c.weeks >= 1],
    ['semanas4', '🗓️', 'Mes perfecto', '4 semanas seguidas cumpliendo la meta', (c) => c.weeks >= 4],
    ['leccion', '📘', 'Primera lección', 'Completaste la lección 1.1', (c) => c.lessons.has('1.1')],
    ['u1', '🏆', 'Unidad 1', 'Completaste «Primer paso»', (c) => c.lessons.has(bossOf(1))],
    ['u2', '🏆', 'Unidad 2', 'Completaste «Construyendo base»', (c) => c.lessons.has(bossOf(2))],
    ['u3', '🏆', 'Unidad 3', 'Completaste «Fuerza»', (c) => c.lessons.has(bossOf(3))],
    ['u4', '🎓', 'Trayecto completo', 'Completaste las 4 unidades', (c) => c.lessons.has(bossOf(4))],
    ['flexion', '💪', 'Flexión de verdad', 'Tu primera flexión completa en el suelo', (c) => c.pushups >= 1],
    ['flex20', '💥', '20 flexiones', '20 flexiones seguidas en una serie', (c) => c.pushups >= 20],
    ['tiron', '🧗', 'Primer tirón', 'Tu primer remo invertido bajo la mesa', (c) => c.rows >= 1],
    ['caminante', '🚶', 'Descanso activo', '5 días de caminata registrados', (c) => c.walks >= 5],
    ['salvavidas', '❄️', 'Salvavidas', 'Usaste un congelador para salvar la racha', (c) => c.freezes >= 1],
    ['mil', '🎯', 'Mil repeticiones', '1.000 repeticiones en total', (c) => c.reps >= 1000]
  ];
  function achievements(st, today) {
    const c = achievementCtx(st, today);
    return ACHIEVEMENTS.map(([id, icon, title, desc, test]) => ({ id, icon, title, desc, got: !!test(c) }));
  }

  const Logic = {
    TZ, MAX_FREEZES, ROUTINES, MINIMAL, EX, defaultState, defaultSettings,
    dayKey, hmNow, addDays, diffDays, weekStart, daysInMonth, dowMon0,
    covered, streakEndingAt, bestStreak, freezesUsed, freezesLeft, canFreeze, streakInfo,
    weekNumber, weekGoal, weekStats, sessionReps, nextType, lastReps,
    UNITS, LESSONS, LESSON_BY_ID, parseEx, completedLessons, nextLesson, todayPlan, routineFor,
    isTraining, dayAdvice, perfectWeeks, bestPerfectWeeks, achievements
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
  if (typeof document === 'undefined') return;     // en Node termina aquí

  /* =====================================================================
     PARTE 2 — INTERFAZ
     ===================================================================== */
  const $ = (s) => document.querySelector(s);
  const appEl = $('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const MESSAGES = [
    '¡Racha en llamas! 🔥 Otro día en el bolsillo.',
    'Hecho es mejor que perfecto. ¡Bien ahí!',
    'Más de 1300 días en Duolingo… ¡y ahora también con tu cuerpo! 💪',
    'Tu yo del futuro te lo agradece. ¡Qué crack!',
    'Cada día cuenta, incluso los de 5 minutos. Eso es constancia.',
    '¡Sesión completada! Descansa, hidrátate y celebra 🎉',
    'Pequeños pasos, gran racha. ¡Sigue así!',
    'Si un día no sale, no pasa nada: volver es lo que importa. ¡Hoy volviste!'
  ];

  /* ------------------------------ Estado ------------------------------ */
  let state = load();
  const ui = { view: 'home', today: dayKey(), cal: dayKey().slice(0, 7), workout: null };
  let restEnd = 0, restTimer = null, audioCtx = null, wakeLock = null, hold = null;

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && s.v === 1 && s.sessions) return Object.assign(defaultState(dayKey()), s, { settings: Object.assign(defaultSettings(), s.settings) });
    } catch (e) { /* datos corruptos: empezamos limpio */ }
    return defaultState(dayKey());
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ No pude guardar. ¿Almacenamiento lleno o modo privado?'); }
  }

  /* ----------------------------- Utilidades UI ----------------------------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3000);
  }
  /** Diálogo propio (promesa). buttons: [{label, cls, value}].
      Tocar fuera o pulsar Escape lo cierra con `false`, salvo opts.noDismiss. */
  function dialog(html, buttons, cls, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      const m = $('#modal');
      m.innerHTML = `<div class="box ${cls || ''}" role="dialog" aria-modal="true">${html}<div class="row2">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
      m.hidden = false;
      const close = (v) => { m.hidden = true; m.onclick = null; document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape' && !o.noDismiss) close(false); };
      document.addEventListener('keydown', onKey);
      m.onclick = (e) => {
        if (e.target === m && !o.noDismiss) { close(false); return; }
        const b = e.target.closest('[data-i]'); if (b) close(buttons[b.dataset.i].value);
      };
      const field = m.querySelector('input'); if (field) field.focus({ preventScroll: true });   // nunca el botón: Enter no debe confirmar un borrado
    });
  }
  const showGuide = (id) => dialog(GUIDES.html(id, esc(EX[id].name)), [{ label: 'Entendido', value: true }], 'guide');
  const confirmBox = (msg, ok = 'Sí') => dialog(`<p>${msg}</p>`, [{ label: 'No', cls: 'secondary', value: false }, { label: ok, value: true }]);

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#confetti'), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const colors = ['#58cc02', '#ff9600', '#1cb0f6', '#ffd900', '#ff4b4b'];
    const ps = Array.from({ length: 90 }, () => ({
      x: c.width / 2, y: c.height * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
      s: 4 + Math.random() * 5, r: Math.random() * 6, col: colors[(Math.random() * colors.length) | 0]
    }));
    const t0 = performance.now();
    (function frame(t) {
      const age = t - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 1800); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); });
      if (age < 1800) requestAnimationFrame(frame); else ctx.clearRect(0, 0, c.width, c.height);
    })(t0);
  }
  /** iOS solo permite sonar si el audio se "desbloquea" durante un toque del usuario. */
  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* sin audio */ }
  }
  function beep() {
    try {
      if (!audioCtx) return;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880; g.gain.value = 0.15;
      o.start(); o.stop(audioCtx.currentTime + 0.25);
    } catch (e) { /* sin audio: no pasa nada */ }
    if (navigator.vibrate) navigator.vibrate(200);
  }

  /* -------------------------------- Descanso -------------------------------- */
  function startRest(sec) {
    restEnd = Date.now() + sec * 1000;
    $('#rest').hidden = false;
    const nx = nextSet(); $('#rest-next').textContent = nx ? `Siguiente: ${nx}` : '';
    clearInterval(restTimer); restTimer = setInterval(tickRest, 250); tickRest();
  }
  /** "Flexiones · serie 2" de la primera serie sin marcar. */
  function nextSet() {
    const dr = state.draft; if (!dr) return '';
    for (const e of routineFor(dr).exercises) {
      const i = dr.sets[e.id].findIndex((x) => !x.d);
      if (i >= 0) return `${e.name} · serie ${i + 1}`;
    }
    return '';
  }
  function stopRest() { clearInterval(restTimer); restTimer = null; $('#rest').hidden = true; }
  function tickRest() {
    const left = Math.ceil((restEnd - Date.now()) / 1000);
    if (left <= 0) { stopRest(); beep(); toast('¡Descanso listo! Siguiente serie 💪'); return; }
    $('#rest-time').textContent = `${Math.floor(left / 60)}:${pad(left % 60)}`;
  }

  /* ------------------------------ Vistas: Hoy ------------------------------ */
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const pickMsg = (k) => MESSAGES[(parseInt(k.replace(/-/g, ''), 10) + Object.keys(state.sessions).length) % MESSAGES.length];

  function homeView() {
    const today = ui.today, info = streakInfo(state, today), y = addDays(today, -1);
    const ws = weekStart(today), wk = weekStats(state, ws), goal = weekGoal(state, ws), pw = perfectWeeks(state, today);
    const left = freezesLeft(state, today.slice(0, 7)), st = state.settings;
    const plan = todayPlan(state), routine = routineFor(plan), lesson = plan.lesson ? LESSON_BY_ID[plan.lesson] : null;
    const advice = dayAdvice(state, today), todaySes = state.sessions[today];
    const hasDraft = state.draft && state.draft.date === today && !state.draft.minimal;
    const frac = Math.min(1, wk.sessions / goal), C = 2 * Math.PI * 40;

    let banners = '';
    if (!isStandalone() && isIOS()) {
      banners += '<div class="banner info">📲 <b>Instálala</b> para usarla como app: en Safari toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>. Ojo: Safari y la app instalada guardan los datos por separado.</div>';
    }
    if (info.rescuable) {
      banners += `<div class="banner warn">Ayer no entrenaste y tu racha de <b>${info.rescueStreak} días</b> se rompió. ¡Todavía puedes salvarla con un congelador ❄️!
        <button class="btn blue" data-act="freeze" data-day="${y}">Usar congelador (${left} disponible${left === 1 ? '' : 's'})</button></div>`;
    }
    if (info.missedYesterday) {
      banners += `<div class="banner info">Ayer no pudiste, ¡y está bien! 💙 La regla es <b>nunca fallar dos días seguidos</b>: hoy toca sí o sí, aunque sea el modo mínimo o una caminata.
        <button class="link" data-act="retro" data-day="${y}">¿Sí entrenaste ayer y olvidaste registrarlo?</button></div>`;
    } else if (!info.coveredToday && info.streak > 0) {
      banners += `<div class="banner warn">Tu racha de <b>${info.streak} ${info.streak === 1 ? 'día' : 'días'}</b> te espera 🔥 ${hmNow() >= st.time ? '¡Ya es tu hora!' : `Tu hora: ${esc(st.time)}.`}</div>`;
    }

    const anchor = st.anchor ? `<p class="anchor">🎯 Después de <b>${esc(st.anchor)}</b>, a las ${esc(st.time)}</p>` : '';
    const trainBlock = `${lesson ? `<small>LECCIÓN ${lesson.id} · UNIDAD ${lesson.unit} · ~${lesson.minutes} min</small>` : ''}<h2>${esc(routine.title)}</h2>
      <ul class="ex-preview">${routine.exercises.map((e) => `<li data-act="guide" data-ex="${e.id}"><span>${esc(e.name)}</span><small>${e.sets}×${esc(e.target)}</small></li>`).join('')}</ul>`;
    const startLabel = hasDraft ? 'Continuar' : lesson ? 'Empezar lección' : 'Empezar rutina';
    let todayCard;
    if (todaySes && todaySes.type === 'W') {
      todayCard = `<div class="banner ok">🚶 <b>Descanso activo registrado.</b> Tu racha sigue viva. ¿Con energía de sobra? También puedes entrenar.
        <button class="btn secondary" data-act="start" data-min="0">Entrenar igual</button></div>`;
    } else if (todaySes) {
      todayCard = `<div class="banner ok">✅ <b>¡Hoy completado!</b> ${esc(pickMsg(today))}</div>`;
    } else if (advice === 'rest' && !hasDraft) {
      todayCard = `<div class="card">${anchor}<small>RECOMENDADO HOY</small><h2>🚶 Descanso activo</h2>
        <p class="muted">${wk.sessions >= goal ? '¡Ya cumpliste tu meta semanal! 🎉' : 'Ayer entrenaste y vas al día con tu meta.'} El músculo crece mientras descansas: camina 20-30 min y registra el día para mantener la racha.</p>
        <button class="btn" data-act="walk">Caminé 20 min ✓</button>
        <button class="btn secondary" data-act="start" data-min="1">Mejor el modo mínimo (5 min)</button>
        <details class="more"><summary>Prefiero entrenar hoy</summary>${trainBlock}
          <button class="btn secondary" data-act="start" data-min="0">${startLabel}</button></details></div>`;
    } else {
      todayCard = `<div class="card">${anchor}${trainBlock}
        <button class="btn" data-act="start" data-min="0">${startLabel}</button>
        <button class="btn secondary" data-act="start" data-min="1">Hoy solo lo mínimo (5 min)</button>
        <button class="link" data-act="walk">Hoy solo puedo caminar 20 min</button></div>`;
    }

    const trainings = Object.values(state.sessions).filter(isTraining).length;
    const needBackup = trainings >= 5 && (!state.lastBackup || diffDays(today, state.lastBackup) >= 30);
    return `
      <div class="hero">
        <div class="flame ${info.coveredToday ? 'on' : ''}" id="flame">🔥</div>
        <div class="streak-n ${info.streak ? '' : 'off'}">${info.streak}</div>
        <div class="streak-label">${info.streak === 1 ? 'día de racha' : 'días de racha'}</div>
        <div class="chips">
          <span class="chip">🏆 Récord: ${info.best}</span>
          <span class="chip">❄️ Congeladores: ${left}/${MAX_FREEZES}</span>
        </div>
      </div>
      ${banners}
      ${todayCard}
      <div class="card ring-row">
        <svg class="ring" viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"/>
          <circle class="fg" cx="50" cy="50" r="40" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}"/>
          <text x="50" y="58" text-anchor="middle">${wk.sessions}/${goal}</text></svg>
        <div><h2>Meta semanal</h2><p class="muted">Semana ${weekNumber(state, ws)} · ${goal} entrenamientos.${wk.sessions >= goal ? ' ¡Meta cumplida! 🎉' : ` Te faltan ${goal - wk.sessions}.`}</p>
          ${pw > 0 ? `<p class="pw">⭐ ${pw} ${pw === 1 ? 'semana perfecta' : 'semanas perfectas seguidas'}</p>` : ''}</div>
      </div>
      ${calendarCard()}
      ${needBackup ? `<div class="banner info">💾 ${state.lastBackup ? 'Hace más de un mes que no respaldas' : 'Aún no respaldas'} tus datos. Si se borran los datos del navegador, perderías tu racha.<button class="btn secondary" data-act="export">Exportar respaldo ahora</button></div>` : ''}`;
  }

  function calendarCard() {
    const ym = ui.cal, [yy, mm] = ym.split('-').map(Number), today = ui.today;
    const lead = dowMon0(`${ym}-01`), n = daysInMonth(ym);
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div class="dow">${d}</div>`).join('') + '<div></div>'.repeat(lead);
    for (let d = 1; d <= n; d++) {
      const k = `${ym}-${pad(d)}`;
      const s = state.sessions[k], cf = canFreeze(state, k, today);
      const cls = ['day', s ? (s.type === 'W' ? 'walk' : 'done') : '', state.freezes[k] ? 'frozen' : '', k === today ? 'today' : '', cf ? 'can-freeze' : ''].join(' ');
      cells += `<button class="${cls}" data-act="${cf ? 'freeze' : s ? 'day' : 'noop'}" data-day="${k}">${d}</button>`;
    }
    return `<div class="card"><div class="cal-head">
        <button class="btn-mini" data-act="cal-prev">‹</button><h2 style="margin:0">${MONTHS[mm - 1]} ${yy}</h2>
        <button class="btn-mini" data-act="cal-next">›</button></div>
      <div class="cal">${cells}</div>
      <div class="legend"><span><i class="lg done"></i>entrenado</span><span><i class="lg walk"></i>caminata</span><span><i class="lg frozen"></i>congelado</span><span><i class="lg can"></i>se puede congelar</span></div>
      <small>Toca un día para ver qué hiciste.</small></div>`;
  }

  function sessionLabel(s) {
    if (s.type === 'W') return '🚶 Descanso activo';
    if (s.type === 'R') return '✍️ Entrenamiento (registrado después)';
    if (s.minimal) return '⚡ Modo mínimo';
    if (s.lesson) return `📘 Lección ${s.lesson} · ${LESSON_BY_ID[s.lesson] ? LESSON_BY_ID[s.lesson].title : ''}${s.partial ? ' (parcial)' : ''}`;
    return `💪 Día ${s.type}`;
  }
  function showDay(k) {
    const s = state.sessions[k]; if (!s) return;
    const rows = Object.keys(s.ex || {}).map((id) => {
      const u = EX[id] && EX[id].unit === 'seg' ? ' seg' : '';
      return `<li><span>${esc(EX[id] ? EX[id].name : id)}</span><small>${s.ex[id].map((n) => (n == null ? '–' : n)).join(' · ')}${u}</small></li>`;
    }).join('');
    dialog(`<small>${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}</small><h2>${esc(sessionLabel(s))}</h2>${rows ? `<ul class="ex-preview">${rows}</ul>` : ''}`, [{ label: 'Cerrar', value: true }], 'guide');
  }

  /** Registra un día sin detalle (caminata o entrenamiento olvidado) y lo celebra. */
  async function logDay(k, type, msg) {
    const before = unlockedIds();
    state.sessions[k] = { type, minimal: false, ex: {} };
    save(); render(); confetti();
    const info = streakInfo(state, ui.today);
    await dialog(`<div class="big">${type === 'W' ? '🚶' : '🔥'}</div><h1>${info.streak} ${info.streak === 1 ? 'día' : 'días'} de racha</h1><p>${esc(msg)}</p>${newBadgesHtml(before)}`, [{ label: 'Continuar', value: true }]);
  }

  /* -------------------------------- Logros (UI) -------------------------------- */
  const unlockedIds = () => new Set(achievements(state, dayKey()).filter((a) => a.got).map((a) => a.id));
  function newBadgesHtml(before) {
    const nw = achievements(state, dayKey()).filter((a) => a.got && !before.has(a.id));
    if (!nw.length) return '';
    return `<p><b>¡Nuevo logro${nw.length > 1 ? 's' : ''}!</b></p><div class="badges">${nw.map((a) => `<div class="badge got"><span>${a.icon}</span><b>${esc(a.title)}</b></div>`).join('')}</div>`;
  }

  /* --------------------------- Vistas: Entrenamiento --------------------------- */
  function startWorkout(minimal) {
    const today = ui.today;
    const wanted = minimal ? null : todayPlan(state);
    if (!state.draft || state.draft.date !== today || state.draft.minimal !== minimal || (wanted && (state.draft.lesson || null) !== (wanted.lesson || null))) {
      const plan = minimal ? { type: 'A' } : todayPlan(state), r = routineFor({ minimal, type: plan.type, lesson: plan.lesson }), sets = {};
      r.exercises.forEach((e) => { sets[e.id] = Array.from({ length: e.sets }, () => ({ v: '', d: false })); });
      state.draft = { date: today, type: plan.type, lesson: plan.lesson || null, minimal, sets };
      save();
    }
    unlockAudio();
    ui.view = 'workout'; render();
  }

  // Calentamiento corto y opcional antes de cada sesión (no cuenta series).
  const WARMUP = ['30 seg de círculos de brazos (adelante y atrás)', '10 sentadillas lentas sin peso', '10 rotaciones de cadera',
    '5 flexiones fáciles en la pared', '30 seg de rodillas arriba en el lugar'];
  /** Tope del rango de repeticiones ("10-12" → 12) para saber cuándo subir la carga. */
  const rangeTop = (target) => { const m = /^(\d+)-(\d+)/.exec(target); return m ? Number(m[2]) : null; };

  function workoutView() {
    const dr = state.draft, r = routineFor(dr), lesson = dr.lesson ? LESSON_BY_ID[dr.lesson] : null;
    const rir = lesson ? UNITS[lesson.unit - 1].rir : null;
    const cards = r.exercises.map((e) => {
      const last = dr.minimal ? null : lastReps(state, e.id), u = e.unit || 'reps';
      const lastTxt = last ? `Última vez: ${last.map((n) => (n == null ? '–' : n)).join(' · ')} ${u}` : '';
      const top = rangeTop(e.target), maxed = !lesson && top && last && last.every((n) => typeof n === 'number' && n >= top);
      const hint = lesson ? lastTxt : maxed ? `${lastTxt} → ¡llegaste al tope del rango! Suma peso a la mochila (1-2 libros) y vuelve a la parte baja del rango`
        : last ? `${lastTxt} → hoy intenta superarlo por +1` : (dr.minimal ? '' : 'Primera vez: anota tus repeticiones para tener un punto de partida.');
      const sets = dr.sets[e.id].map((s, i) => {
        const ph = !lesson && last && typeof last[i] === 'number' ? last[i] + 1 : e.def;   // en lecciones la meta es la de la lección
        return `<div class="set ${s.d ? 'done' : ''}" data-ex="${e.id}" data-i="${i}"><label>Serie ${i + 1}</label>
          <input type="number" inputmode="numeric" min="0" placeholder="${ph} ${u}" value="${esc(s.v)}" aria-label="${esc(e.name)} serie ${i + 1} (${u})">
          ${u === 'seg' ? '<button class="hold" data-act="hold" aria-label="Iniciar cronómetro">▶</button>' : ''}
          <button class="check" data-act="check" aria-label="Marcar serie">✓</button></div>`;
      }).join('');
      const complete = dr.sets[e.id].every((x) => x.d);
      return `<div class="card ex-card ${complete ? 'complete' : ''}" data-card="${e.id}"><h3><span>${esc(e.name)}</span><span class="target">${e.sets}×${esc(e.target)}</span></h3><button class="info-btn" data-act="guide" data-ex="${e.id}">▶ Cómo hacerlo</button>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}${sets}</div>`;
    }).join('');
    return `<div class="top"><button class="x" data-act="back" aria-label="Salir">✕</button><div class="bar"><i id="wbar"></i></div></div>
      <h1>${esc(lesson ? `Lección ${lesson.id} · ${r.title}` : r.title)}</h1>
      ${rir ? `<div class="banner info">💡 <b>Intensidad RIR ${rir}:</b> termina cada serie sintiendo que podrías hacer unas ${rir} repeticiones más. La primera serie de cada ejercicio puede ser más suave (aproximación). Si una serie te cuesta mucho menos o mucho más, ajusta la carga o la variante.</div>` : ''}
      ${dr.minimal ? '' : `<details class="card warmup"><summary>🔥 Calentamiento (2 min, opcional)</summary><ul class="steps">${WARMUP.map((w) => `<li>${w}</li>`).join('')}</ul></details>`}${cards}
      <button class="btn" id="finish" data-act="finish">Terminar sesión</button>`;
  }

  function refreshWorkoutProgress() {
    const dr = state.draft; if (!dr) return;
    const all = Object.values(dr.sets).flat(), done = all.filter((s) => s.d).length;
    const bar = $('#wbar'), fin = $('#finish');
    if (bar) bar.style.width = `${(done / all.length) * 100}%`;
    if (fin) { fin.disabled = done === 0; fin.textContent = done === all.length ? '¡Terminar sesión!' : 'Terminar sesión'; }
  }

  /** Marca/desmarca una serie: progreso, descanso (doble al cerrar un ejercicio) y salto al siguiente. */
  function markSet(row, done) {
    const sets = state.draft.sets[row.dataset.ex], s = sets[row.dataset.i];
    s.d = done; row.classList.toggle('done', done); save(); refreshWorkoutProgress();
    const card = row.closest('.ex-card'), exDone = sets.every((x) => x.d);
    card.classList.toggle('complete', exDone);
    const all = Object.values(state.draft.sets).flat();
    if (done && !all.every((x) => x.d)) startRest(state.settings.rest * (exDone ? 2 : 1)); else stopRest();
    if (done && navigator.vibrate) navigator.vibrate(30);
    if (done && exDone) {
      const next = Array.from(document.querySelectorAll('.ex-card:not(.complete)'))[0];
      if (next) setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
  }

  /* Cronómetro de series por tiempo (plancha): cuenta atrás desde la meta y marca la serie.
     Tocar de nuevo lo detiene y anota los segundos aguantados. */
  function startHold(row) {
    if (hold) { const same = hold.row === row; finishHold(true); if (same) return; }
    unlockAudio(); stopRest();
    const inp = row.querySelector('input');
    const secs = Number(inp.value) || parseInt(inp.placeholder, 10) || 30;
    hold = { row, total: secs, start: Date.now(), end: Date.now() + secs * 1000, t: setInterval(tickHold, 200) };
    row.classList.add('holding'); tickHold();
  }
  function tickHold() {
    const left = Math.ceil((hold.end - Date.now()) / 1000);
    if (left <= 0) { finishHold(false); return; }
    hold.row.querySelector('.hold').textContent = left;
  }
  function finishHold(early) {
    const h = hold; if (!h) return;
    clearInterval(h.t); hold = null;
    h.row.classList.remove('holding');
    const b = h.row.querySelector('.hold'); if (b) b.textContent = '▶';
    if (!document.body.contains(h.row)) return;
    const secs = early ? Math.round((Date.now() - h.start) / 1000) : h.total;
    if (early && secs < 3) return;                    // toque accidental
    h.row.querySelector('input').value = secs;
    state.draft.sets[h.row.dataset.ex][h.row.dataset.i].v = String(secs);
    if (!early) beep();
    markSet(h.row, true);
  }

  async function finishWorkout() {
    const dr = state.draft, all = Object.values(dr.sets).flat(), done = all.filter((s) => s.d).length;
    const routine = routineFor(dr), partial = !!dr.lesson && done < Math.ceil(all.length * 0.8);
    if (done < all.length && !(await confirmBox(`Te faltan ${all.length - done} series. ¿Guardar la sesión igual?${dr.lesson ? ' La racha cuenta; la lección se supera con al menos el 80% de las series.' : ''}`, 'Guardar'))) return;
    const before = unlockedIds();
    const ex = {};
    for (const id in dr.sets) {
      const def = routine.exercises.find((e) => e.id === id).def;
      ex[id] = dr.sets[id].map((s) => (s.d ? (s.v !== '' ? Math.max(0, Number(s.v)) : def) : null));
    }
    const today = dr.date;
    state.sessions[today] = { type: dr.type, minimal: dr.minimal, ex };
    if (dr.lesson) { state.sessions[today].lesson = dr.lesson; if (partial) state.sessions[today].partial = true; }
    state.draft = null; save(); stopRest();
    ui.view = 'home'; ui.today = dayKey(); ui.cal = ui.today.slice(0, 7);   // si terminó pasada la medianoche, la sesión queda en el día que empezó
    const info = streakInfo(state, ui.today);
    let msg = dr.minimal ? 'Los 5 minutos también cuentan. ¡Eso es constancia! 💚' : MESSAGES[Object.keys(state.sessions).length % MESSAGES.length];
    let lessonMsg = '';
    if (dr.lesson) {
      const l = LESSON_BY_ID[dr.lesson], nx = nextLesson(state);
      if (partial) lessonMsg = `La lección ${l.id} sigue pendiente (te faltaron series), pero tu racha cuenta. ¡Mañana la terminas!`;
      else lessonMsg = (l.boss ? `🏆 ¡Unidad ${l.unit} completada! ` : `✅ Lección ${l.id} completada. `) + (nx ? `Siguiente: «${nx.title}».` : '¡Terminaste todo el trayecto! Ahora sigues con la rutina A/B 💪');
    }
    render(); confetti();
    const f = $('#flame'); if (f) f.classList.add('pop');
    await dialog(`<div class="big">🔥</div><h1>${info.streak} ${info.streak === 1 ? 'día' : 'días'} de racha</h1><p>${esc(msg)}</p>${lessonMsg ? `<p><b>${esc(lessonMsg)}</b></p>` : ''}${newBadgesHtml(before)}`, [{ label: 'Continuar', value: true }]);
  }

  /* ---------------------------- Vistas: Trayecto ---------------------------- */
  const NODE_OFFSETS = [0, 38, 60, 38, 0, -38, -60, -38];   // zigzag horizontal (px) como en Duolingo
  function pathView() {
    const done = completedLessons(state), next = nextLesson(state);
    let i = 0, html = '<h1>Tu trayecto</h1>';
    if (state.settings.path === false) html += '<div class="banner info">El trayecto está apagado en Ajustes: hoy se alterna la rutina A/B.</div>';
    UNITS.forEach((u) => {
      const cnt = u.lessons.filter((l) => done.has(l.id)).length;
      html += `<section class="unit"><div class="unit-head"><div><small>UNIDAD ${u.n}</small><h2>${esc(u.title)}</h2><span>${esc(u.sub)}</span></div><b class="unit-count">${cnt}/${u.lessons.length}</b></div><div class="nodes">`;
      u.lessons.forEach((l) => {
        const st = done.has(l.id) ? 'done' : next && next.id === l.id ? 'current' : 'locked';
        const icon = st === 'done' ? '✓' : st === 'locked' ? '🔒' : l.boss ? '🏆' : '💪';
        html += `<div class="node-wrap" style="transform:translateX(${NODE_OFFSETS[i++ % NODE_OFFSETS.length]}px)">
          ${st === 'current' ? '<div class="bubble">¡EMPIEZA!</div>' : ''}
          <button class="node ${st} ${l.boss ? 'boss' : ''}" data-act="lesson" data-id="${l.id}" aria-label="Lección ${l.id}: ${esc(l.title)}">${icon}</button>
          <div class="node-label">${esc(l.title)}</div></div>`;
      });
      html += '</div></section>';
    });
    if (!next) html += '<div class="banner ok">🎉 <b>¡Completaste el trayecto!</b> Desde ahora entrenas con la rutina completa A/B y subes +1 repetición cuando puedas.</div>';
    return html;
  }
  /** Detalle de una lección al tocar su nodo. */
  async function showLesson(id) {
    const l = LESSON_BY_ID[id], done = completedLessons(state), next = nextLesson(state);
    if (!done.has(id) && !(next && next.id === id)) { toast('🔒 Completa primero la lección anterior'); return; }
    const isNext = next && next.id === id, doneToday = !!state.sessions[ui.today];
    const body = `<small>LECCIÓN ${l.id} · UNIDAD ${l.unit}</small><h2>${esc(l.title)}</h2>
      <p class="muted">~${l.minutes} min · RIR ${UNITS[l.unit - 1].rir}${done.has(id) ? ' · ✓ completada' : ''}</p>
      <ul class="ex-preview">${l.exercises.map((e) => `<li><span>${esc(e.name)}</span><small>${e.sets}×${esc(e.target)}</small></li>`).join('')}</ul>
      ${isNext && doneToday ? '<p class="muted">Hoy ya entrenaste. Esta lección te espera mañana 🙂</p>' : ''}`;
    const go = await dialog(body, isNext && !doneToday ? [{ label: 'Cerrar', cls: 'secondary', value: false }, { label: 'Empezar', value: true }] : [{ label: 'Cerrar', value: false }], 'guide');
    if (go) startWorkout(false);
  }

  /* ---------------------------- Vistas: Progreso ---------------------------- */
  function barChart(values, labels, color, goal) {
    const W = 320, H = 150, pl = 8, pb = 22, pt = 18, n = values.length;
    const max = Math.max(1, ...values, goal || 0), bw = (W - pl * 2) / n;
    const y = (v) => pt + (H - pt - pb) * (1 - v / max);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
    values.forEach((v, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64, h = H - pb - y(v);
      s += `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 2).toFixed(1)}" rx="4" fill="${color}"/>`;
      s += `<text class="val" x="${(x + w / 2).toFixed(1)}" y="${(y(v) - 4).toFixed(1)}" text-anchor="middle">${v}</text>`;
      s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`;
    });
    if (goal) s += `<line x1="${pl}" x2="${W - pl}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" stroke="#ff9600" stroke-dasharray="4 3"/>`;
    return s + '</svg>';
  }
  /** Línea simple para peso o cintura. points: [{k, v}] ordenados por fecha. */
  function lineChart(points, color, unit) {
    if (points.length < 2) return '<p class="muted">Registra al menos 2 mediciones para ver la curva.</p>';
    const W = 320, H = 120, pl = 34, pr = 12, pt = 14, pb = 20, vs = points.map((p) => p.v);
    let min = Math.min(...vs), max = Math.max(...vs);
    if (max - min < 1) { max += 0.5; min -= 0.5; }
    const x = (i) => pl + ((W - pl - pr) * i) / (points.length - 1), y = (v) => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const lbl = (k) => `${k.slice(8)}/${k.slice(5, 7)}`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">
      <text x="2" y="${y(max) + 4}">${max.toFixed(1)}</text><text x="2" y="${y(min) + 4}">${min.toFixed(1)}</text>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${color}"/>`).join('')}
      <text x="${pl}" y="${H - 4}">${lbl(points[0].k)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${lbl(points[points.length - 1].k)}</text>
      <text class="val" x="${W - pr}" y="10" text-anchor="end">${vs[vs.length - 1]} ${unit}</text></svg>`;
  }
  function bodyCard() {
    const keys = Object.keys(state.body).sort(), last = keys.length ? state.body[keys[keys.length - 1]] : {};
    const series = (f) => keys.filter((k) => typeof state.body[k][f] === 'number').map((k) => ({ k, v: state.body[k][f] }));
    const kg = series('kg'), cm = series('cm');
    const delta = (a, u) => (a.length >= 2 ? ` (${a[a.length - 1].v - a[0].v >= 0 ? '+' : ''}${(a[a.length - 1].v - a[0].v).toFixed(1)} ${u} desde el inicio)` : '');
    return `<div class="card"><h2>⚖️ Peso y cintura</h2>
      <p class="muted">En recomposición el peso casi no cambia: la cintura y tus repeticiones cuentan mejor la historia. Mídete una vez por semana, en ayunas, el mismo día.</p>
      <div class="row"><label for="b-kg">Peso (kg)</label><input id="b-kg" type="text" inputmode="decimal" placeholder="${last.kg || '73,5'}"></div>
      <div class="row"><label for="b-cm">Cintura (cm, a la altura del ombligo)</label><input id="b-cm" type="text" inputmode="decimal" placeholder="${last.cm || '80'}"></div>
      <button class="btn secondary" data-act="body-save">Guardar medición de hoy</button>
      ${kg.length ? `<h3>Peso${delta(kg, 'kg')}</h3>${lineChart(kg, '#ff9600', 'kg')}` : ''}
      ${cm.length ? `<h3>Cintura${delta(cm, 'cm')}</h3>${lineChart(cm, '#58cc02', 'cm')}` : ''}</div>`;
  }
  function badgesCard() {
    const list = achievements(state, ui.today), got = list.filter((a) => a.got).length;
    return `<div class="card"><h2>🏅 Logros · ${got}/${list.length}</h2><div class="badges">${list.map((a) =>
      `<div class="badge ${a.got ? 'got' : ''}"><span>${a.got ? a.icon : '🔒'}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div></div>`;
  }

  function progressView() {
    const ws0 = weekStart(ui.today), weeks = [];
    for (let i = 7; i >= 0; i--) { const ws = addDays(ws0, -7 * i); weeks.push({ ws, ...weekStats(state, ws) }); }
    const labels = weeks.map((w) => `${w.ws.slice(8)}/${w.ws.slice(5, 7)}`);
    const total = Object.values(state.sessions).filter(isTraining).length, info = streakInfo(state, ui.today);
    return `<h1>Tu progreso</h1>
      <div class="card"><div class="chips" style="margin:0;justify-content:space-around">
        <span class="chip">🔥 ${info.streak} racha</span><span class="chip">🏆 ${info.best} récord</span><span class="chip">💪 ${total} entrenamientos</span><span class="chip">⭐ ${perfectWeeks(state, ui.today)} sem. perfectas</span></div></div>
      ${badgesCard()}
      <div class="card"><h2>Sesiones por semana</h2><small>La línea naranja es tu meta semanal actual.</small>
        ${barChart(weeks.map((w) => w.sessions), labels, '#58cc02', weekGoal(state, ws0))}</div>
      <div class="card"><h2>Repeticiones totales por semana</h2><small>No incluye la plancha (va en segundos). Etiquetas: lunes de cada semana.</small>
        ${barChart(weeks.map((w) => w.reps), labels, '#1cb0f6')}</div>
      ${bodyCard()}`;
  }

  /* ---------------------------- Vistas: Ajustes ---------------------------- */
  function settingsView() {
    const st = state.settings, perm = 'Notification' in window ? Notification.permission : 'no soportado';
    return `<h1>Ajustes</h1>
      <div class="card"><h2>📖 Guía de ejercicios</h2><p class="muted">Toca uno para ver la animación y cómo hacerlo bien.</p>
        <div class="guide-list">${GUIDES.ids.map((id) => `<button class="btn-mini" data-act="guide" data-ex="${id}">${esc(EX[id].name)}</button>`).join('')}</div></div>
      <div class="card"><h2>⏰ Recordatorio</h2>
        <div class="row"><label for="s-anchor">Después de… (tu gatillo)</label><input id="s-anchor" type="text" maxlength="60" placeholder="llegar a casa" value="${esc(st.anchor || '')}"></div>
        <div class="row"><label for="s-time">Hora</label><input id="s-time" type="time" value="${esc(st.time)}"></div>
        <div class="row"><label for="s-path">Usar el trayecto (lecciones que suben de nivel)</label><input id="s-path" type="checkbox" ${st.path !== false ? 'checked' : ''}></div>
        <div class="row"><label for="s-rest">Descanso entre series</label>
          <select id="s-rest">${[60, 75, 90].map((n) => `<option value="${n}" ${st.rest === n ? 'selected' : ''}>${n} seg</option>`).join('')}</select></div>
        <button class="btn blue" data-act="notify">${st.notify && perm === 'granted' ? 'Notificaciones activadas ✓' : 'Activar notificaciones'}</button>
        <div class="banner warn"><b>Ojo, sé realista:</b> en iPhone una web app <b>no puede</b> programar avisos por sí sola (para eso haría falta un servidor push). Las notificaciones de esta app solo se disparan <i>mientras la app está abierta</i>. Por eso hay dos respaldos: el aviso dentro de la app al abrirla (si hoy no has entrenado) y la automatización de Atajos de aquí abajo, que sí es confiable.</div>
        <small>Permiso del navegador: ${esc(perm)}</small></div>

      <div class="card"><h2>📲 Recordatorio diario con Atajos de iOS</h2>
        <details open><summary>Guía paso a paso</summary>
        <ol class="steps">
          <li>Abre la app <b>Atajos</b> y ve a la pestaña <b>Automatización</b>.</li>
          <li>Toca <b>+</b> → <b>Hora del día</b>.</li>
          <li>Elige tu hora (${esc(st.time)}), selecciona <b>Diariamente</b> y toca <b>Siguiente</b>.</li>
          <li>Toca <b>Añadir acción</b> → busca <b>Mostrar notificación</b> y escribe: «¡Hora de tu rutina! 🔥 Cuida tu racha».</li>
          <li>Toca <b>+</b> para otra acción → busca <b>Abrir app</b> y elige «Rutina» (la app instalada en tu pantalla de inicio).</li>
          <li>Toca <b>Siguiente</b>, activa <b>Ejecutar inmediatamente</b> y desactiva «Notificar al ejecutar». Toca <b>Aceptar</b>.</li>
          <li>Comprueba en Ajustes → Notificaciones → <b>Atajos</b> que las notificaciones estén permitidas.</li>
        </ol>
        <p class="muted">Evita «Abrir URL»: abre Safari, que guarda los datos aparte de la app instalada, y verías la app vacía. Si «Abrir app» no muestra «Rutina», basta con la notificación: tócala y abre la app desde su ícono.</p>
        <p class="muted">Truco: en la pantalla de inicio puedes agregar el widget de <b>Atajos</b> con un atajo que abra la app. Es lo más parecido a un widget que permite iOS para una web app.</p>
        <div class="url">${esc(location.href.split('#')[0])}</div></details></div>

      <div class="card"><h2>💾 Respaldo de datos</h2>
        <p class="muted">Todo se guarda solo en este dispositivo. Si borras los datos de Safari o desinstalas la app, se pierde: haz respaldos de vez en cuando.</p>
        <p class="muted">Último respaldo: <b>${state.lastBackup ? `${state.lastBackup.slice(8)}/${state.lastBackup.slice(5, 7)}/${state.lastBackup.slice(0, 4)}` : 'nunca'}</b></p>
        <button class="btn secondary" data-act="export">Exportar respaldo (.json)</button>
        <button class="btn secondary" data-act="copy">Copiar respaldo al portapapeles</button>
        <label class="btn secondary" style="cursor:pointer">Importar desde archivo<input id="imp-file" type="file" accept="application/json,.json" hidden></label>
        <textarea id="imp-text" placeholder="…o pega aquí el respaldo JSON"></textarea>
        <button class="btn secondary" data-act="import-text">Importar texto pegado</button>
        <button class="btn danger" data-act="reset">Borrar todos los datos</button></div>
      <button class="btn secondary" data-act="onboarding">Ver la introducción otra vez</button>`;
  }

  /* -------------------------- Respaldo: exportar/importar -------------------------- */
  const backupJSON = () => JSON.stringify(state, null, 2);
  function exportFile() {
    const url = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `rutina-respaldo-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    state.lastBackup = dayKey(); save();
  }
  async function importJSON(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('❌ Eso no es un JSON válido'); return; }
    if (!data || data.v !== 1 || typeof data.sessions !== 'object' || typeof data.freezes !== 'object') { toast('❌ No parece un respaldo de esta app'); return; }
    if (!(await confirmBox(`Esto reemplazará tus datos actuales por el respaldo (${Object.keys(data.sessions).length} sesiones). ¿Continuar?`, 'Importar'))) return;
    state = Object.assign(defaultState(dayKey()), data, { settings: Object.assign(defaultSettings(), data.settings) });
    save(); scheduleChecks(); render(); toast('✅ Respaldo importado');
  }

  /* ---------------------------------- Bienvenida ---------------------------------- */
  async function onboarding() {
    const nd = { noDismiss: true };
    await dialog(`<div class="big">🔥</div><h1>¡Hola!</h1><p>Esta app funciona como tu racha de Duolingo, pero para entrenar en casa.</p>
      <ul class="steps"><li><b>Racha diaria:</b> entrenar, el modo mínimo (5 min) o una caminata de 20 min: todo cuenta.</li>
      <li><b>Regla de oro:</b> nunca fallar dos días seguidos.</li>
      <li><b>Trayecto:</b> lecciones cortas que suben de nivel poco a poco. Empiezas desde cero.</li></ul>`, [{ label: 'Siguiente', value: true }], 'guide', nd);
    await dialog(`<h2>🎯 Tu gatillo</h2><p>Un hábito se pega mejor a algo que ya haces todos los días. Completa la frase:</p>
      <label class="field">Después de…<input id="ob-anchor" type="text" maxlength="60" placeholder="llegar a casa del trabajo" value="${esc(state.settings.anchor || '')}"></label>
      <label class="field">…a eso de las<input id="ob-time" type="time" value="${esc(state.settings.time)}"></label>`, [{ label: 'Guardar', value: true }], 'guide', nd);
    const a = $('#ob-anchor'), t = $('#ob-time');
    if (a && a.value.trim()) state.settings.anchor = a.value.trim();
    if (t && t.value) { state.settings.time = t.value; state.lastNotified = null; }
    await dialog(`<h2>📲 Último paso</h2>${isStandalone() ? '' : '<p><b>Instálala:</b> en Safari toca Compartir → Agregar a pantalla de inicio, y usa siempre ese ícono (Safari y la app instalada guardan los datos por separado).</p>'}
      <p><b>Recordatorio diario:</b> en Ajustes hay una guía para que la app Atajos te avise todos los días a tu hora. En iPhone es lo que mejor funciona.</p>`, [{ label: '¡Vamos!', value: true }], 'guide', nd);
    state.onboarded = true; save(); render();
  }

  /* ------------------------------- Pantalla encendida ------------------------------- */
  /** Evita que el iPhone apague la pantalla durante el entrenamiento (si el navegador lo permite). */
  async function keepAwake(on) {
    try {
      if (on && !wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* no soportado o denegado: no pasa nada */ }
  }

  /* ------------------------------- Notificaciones ------------------------------- */
  async function enableNotifications() {
    if (!('Notification' in window)) { toast('Este navegador no soporta notificaciones. Usa la guía de Atajos.'); return; }
    const p = await Notification.requestPermission();
    state.settings.notify = p === 'granted'; save();
    toast(p === 'granted' ? '✅ Activadas (solo con la app abierta)' : 'Permiso no concedido. Usa la guía de Atajos 👇');
    render();
  }
  /** Con la app abierta: a la hora elegida, si hoy no entrenaste, avisa (una vez al día). */
  function checkReminder() {
    if (!state.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = dayKey();
    if (state.sessions[today] || state.lastNotified === today || hmNow() < state.settings.time) return;
    state.lastNotified = today; save();
    const opts = { body: 'Tu racha te espera. ¡Aunque sea 5 minutos!', icon: 'icons/icon-192.png', tag: 'rutina-diaria' };
    if (navigator.serviceWorker) navigator.serviceWorker.ready.then((r) => r.showNotification('¡Hora de tu rutina! 🔥', opts)).catch(() => new Notification('¡Hora de tu rutina! 🔥', opts));
    else new Notification('¡Hora de tu rutina! 🔥', opts);
  }
  let checksT;
  function scheduleChecks() { clearInterval(checksT); checksT = setInterval(tick, 30000); }
  /** Cada 30 s: detecta el cambio de día a medianoche local y revisa el recordatorio. */
  function tick() {
    const t = dayKey();
    if (t !== ui.today) {
      ui.today = t; ui.cal = t.slice(0, 7);
      if (ui.view !== 'workout') render();
    }
    checkReminder();
  }

  /* --------------------------------- Render --------------------------------- */
  function render() {
    // Un borrador de otro día se descarta
    if (state.draft && state.draft.date !== ui.today && ui.view !== 'workout') { state.draft = null; save(); }
    const v = ui.view;
    document.body.classList.toggle('in-workout', v === 'workout');
    appEl.innerHTML = v === 'workout' ? workoutView() : v === 'path' ? pathView() : v === 'progress' ? progressView() : v === 'settings' ? settingsView() : homeView();
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === v));
    if (v === 'workout') refreshWorkoutProgress(); else if (!$('#rest').hidden) stopRest();
    if (v !== 'workout' && hold) { clearInterval(hold.t); hold = null; }
    keepAwake(v === 'workout');
    if (v === 'path') requestAnimationFrame(() => { const c = $('.node.current'); if (c) c.scrollIntoView({ block: 'center' }); });
    else window.scrollTo(0, 0);
  }

  /* --------------------------------- Eventos --------------------------------- */
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    ui.view = b.dataset.tab; render();
  });

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    switch (act) {
      case 'guide': showGuide(el.dataset.ex); break;
      case 'lesson': showLesson(el.dataset.id); break;
      case 'start': startWorkout(el.dataset.min === '1'); break;
      case 'back':
        if (await confirmBox('¿Salir? Tu progreso de hoy queda guardado como borrador.', 'Salir')) { ui.view = 'home'; render(); }
        break;
      case 'check': {
        const row = el.closest('.set');
        if (hold && hold.row === row) { clearInterval(hold.t); hold = null; row.classList.remove('holding'); row.querySelector('.hold').textContent = '▶'; }
        unlockAudio(); markSet(row, !state.draft.sets[row.dataset.ex][row.dataset.i].d);
        break;
      }
      case 'hold': startHold(el.closest('.set')); break;
      case 'day': showDay(el.dataset.day); break;
      case 'walk': logDay(ui.today, 'W', '¡Descanso activo registrado! Caminar también es entrenar tu constancia 💚'); break;
      case 'retro':
        if (await confirmBox('¿Registrar ayer como día entrenado? Úsalo solo si de verdad entrenaste 😉', 'Registrar')) {
          logDay(el.dataset.day, 'R', '¡Listo! Ayer quedó registrado y tu racha sigue viva.');
        }
        break;
      case 'body-save': {
        const num = (id) => { const v = parseFloat(($(id).value || '').replace(',', '.')); return isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null; };
        const kg = num('#b-kg'), cm = num('#b-cm');
        if (kg == null && cm == null) { toast('Escribe tu peso o tu cintura'); break; }
        if ((kg != null && (kg < 30 || kg > 250)) || (cm != null && (cm < 40 || cm > 200))) { toast('Revisa el número: parece fuera de rango'); break; }
        const prev = state.body[ui.today] || {};
        state.body[ui.today] = { kg: kg != null ? kg : prev.kg, cm: cm != null ? cm : prev.cm };
        save(); render(); toast('✅ Medición guardada');
        break;
      }
      case 'onboarding': onboarding(); break;
      case 'finish': finishWorkout(); break;
      case 'rest-plus': restEnd += 15000; tickRest(); break;
      case 'rest-minus': restEnd -= 15000; tickRest(); break;
      case 'rest-skip': stopRest(); break;
      case 'cal-prev': case 'cal-next': {
        let [y, m] = ui.cal.split('-').map(Number); m += act === 'cal-next' ? 1 : -1;
        if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
        ui.cal = `${y}-${pad(m)}`; render(); break;
      }
      case 'freeze': {
        const k = el.dataset.day;
        if (!canFreeze(state, k, ui.today)) { toast('Ese día ya no se puede congelar'); break; }
        const left = freezesLeft(state, k.slice(0, 7));
        if (await confirmBox(`¿Usar un congelador ❄️ para el ${k.slice(8)}/${k.slice(5, 7)}? Te quedarán ${left - 1} este mes.`, 'Congelar')) {
          state.freezes[k] = true; save(); render(); toast('❄️ ¡Racha salvada!');
        }
        break;
      }
      case 'notify': enableNotifications(); break;
      case 'export': exportFile(); break;
      case 'copy':
        try { await navigator.clipboard.writeText(backupJSON()); state.lastBackup = dayKey(); save(); toast('📋 Respaldo copiado'); } catch (err) { toast('No pude copiar. Usa «Exportar».'); }
        break;
      case 'import-text': importJSON($('#imp-text').value); break;
      case 'reset':
        if (await confirmBox('Se borrarán TODAS tus sesiones y rachas. Esto no se puede deshacer. ¿Seguro?', 'Borrar')) {
          state = defaultState(dayKey()); save(); render(); toast('Datos borrados');
        }
        break;
      default: break;
    }
  });

  document.addEventListener('input', (e) => {
    const inp = e.target;
    if (inp.matches('.set input') && state.draft) {            // anota repeticiones sin re-renderizar
      const row = inp.closest('.set'); state.draft.sets[row.dataset.ex][row.dataset.i].v = inp.value; save();
    } else if (inp.id === 's-anchor') { state.settings.anchor = inp.value.trim(); save(); }
    else if (inp.id === 's-time') { state.settings.time = inp.value || '20:00'; state.lastNotified = null; save(); }
    else if (inp.id === 's-path') { state.settings.path = inp.checked; save(); }
    else if (inp.id === 's-rest') { state.settings.rest = Number(inp.value); save(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'imp-file' || !e.target.files[0]) return;
    const r = new FileReader(); r.onload = () => importJSON(String(r.result)); r.readAsText(e.target.files[0]); e.target.value = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    tick();
    if (ui.view === 'workout') keepAwake(true);    // iOS suelta el bloqueo al salir de la app
  });

  /* ---------------------------------- Inicio ---------------------------------- */
  render(); tick(); scheduleChecks();
  if (!state.onboarded) onboarding();
  // Pide al navegador no borrar los datos aunque falte espacio (Safari 17+; si no, se ignora)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) {
    // Si una versión nueva toma el control, recarga una vez para mostrarla (no si es la primera instalación)
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded && ui.view !== 'workout') { reloaded = true; location.reload(); } });
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW (p. ej. file://): la app igual funciona */ });
})();
