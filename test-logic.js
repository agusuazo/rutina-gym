/* Pruebas de la lógica de racha. Uso: node test-logic.js */
const assert = require('assert');
const L = require('./app.js');

let passed = 0;
function t(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }
const mk = (today, sessionDays = [], freezeDays = [], start) => {
  const st = L.defaultState(start || sessionDays.slice().sort()[0] || today);
  sessionDays.forEach((k) => { st.sessions[k] = { type: 'A', minimal: false, ex: { flexiones: [10, 10, 10] } }; });
  freezeDays.forEach((k) => { st.freezes[k] = true; });
  return st;
};
const days = (from, n) => Array.from({ length: n }, (_, i) => L.addDays(from, i));

console.log('Racha básica');
t('3 días seguidos, hoy ya entrenado → 3', () => {
  const st = mk('2026-10-07', ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.strictEqual(L.streakInfo(st, '2026-10-07').streak, 3);
});
t('hoy aún sin entrenar pero ayer sí → la racha sigue viva (3)', () => {
  const st = mk('2026-10-07', ['2026-10-04', '2026-10-05', '2026-10-06']);
  const i = L.streakInfo(st, '2026-10-07');
  assert.strictEqual(i.streak, 3); assert.strictEqual(i.lost, false); assert.strictEqual(i.missedYesterday, false);
});

console.log('Día perdido');
t('ayer no entrené y hoy tampoco → racha 0, aviso "obligatorio hoy"', () => {
  const st = mk('2026-10-07', ['2026-10-03', '2026-10-04', '2026-10-05']);
  const i = L.streakInfo(st, '2026-10-07');
  assert.strictEqual(i.streak, 0); assert.strictEqual(i.lost, true); assert.strictEqual(i.missedYesterday, true);
  assert.strictEqual(i.rescueStreak, 3);
});
t('día perdido y entreno hoy sin congelador → la racha reinicia en 1, récord se conserva', () => {
  const st = mk('2026-10-07', ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-07']);
  const i = L.streakInfo(st, '2026-10-07');
  assert.strictEqual(i.streak, 1); assert.strictEqual(i.best, 3);
});
t('usuario nuevo el primer día: sin aviso de "ayer no entrené"', () => {
  const st = L.defaultState('2026-10-07');
  assert.strictEqual(L.streakInfo(st, '2026-10-07').missedYesterday, false);
});

console.log('Congelador');
t('congelar ayer rescata la racha y la continúa al entrenar hoy (el día congelado no suma)', () => {
  const st = mk('2026-10-07', ['2026-10-03', '2026-10-04', '2026-10-05']);
  assert.strictEqual(L.canFreeze(st, '2026-10-06', '2026-10-07'), true);
  assert.strictEqual(L.streakInfo(st, '2026-10-07').rescuable, true);
  st.freezes['2026-10-06'] = true;
  assert.strictEqual(L.streakInfo(st, '2026-10-07').streak, 3);       // viva, hoy pendiente
  st.sessions['2026-10-07'] = { type: 'B', minimal: true, ex: {} };
  assert.strictEqual(L.streakInfo(st, '2026-10-07').streak, 4);       // 3 + hoy; el congelado no cuenta
});
t('máximo 2 congeladores por mes', () => {
  const st = mk('2026-10-20', ['2026-10-10', '2026-10-13', '2026-10-17'], ['2026-10-11', '2026-10-14']);
  st.sessions['2026-10-19'] = { type: 'A', minimal: false, ex: {} };
  assert.strictEqual(L.freezesLeft(st, '2026-10'), 0);
  assert.strictEqual(L.canFreeze(st, '2026-10-18', '2026-10-20'), false);   // sin cupo
  assert.strictEqual(L.freezesLeft(st, '2026-11'), 2);                       // otro mes tiene cupo completo
});
t('no se puede congelar hoy, el futuro, días de hace >2 días, ni si la racha ya estaba rota', () => {
  const st = mk('2026-10-10', ['2026-10-01']);
  assert.strictEqual(L.canFreeze(st, '2026-10-10', '2026-10-10'), false);
  assert.strictEqual(L.canFreeze(st, '2026-10-11', '2026-10-10'), false);
  assert.strictEqual(L.canFreeze(st, '2026-10-05', '2026-10-10'), false);
  assert.strictEqual(L.canFreeze(st, '2026-10-09', '2026-10-10'), false); // 10-08 sin cubrir: ya estaba rota
});
t('dos días perdidos seguidos: no es rescatable con un solo congelador', () => {
  const st = mk('2026-10-07', ['2026-10-04', '2026-10-05']);   // faltan 06 y hoy aún no
  const i = L.streakInfo(st, '2026-10-07');
  assert.strictEqual(i.rescuable, true);                       // ayer (06) sí; 05 está cubierto
  const st2 = mk('2026-10-08', ['2026-10-04', '2026-10-05']);  // faltan 06 y 07
  assert.strictEqual(L.streakInfo(st2, '2026-10-08').rescuable, false);
});

console.log('Cambio de mes / año');
t('racha cruza fin de mes (30 sep → 1 oct)', () => {
  const st = mk('2026-10-02', ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  assert.strictEqual(L.streakInfo(st, '2026-10-02').streak, 4);
});
t('racha cruza fin de año y febrero bisiesto', () => {
  assert.strictEqual(L.streakInfo(mk('2027-01-02', ['2026-12-31', '2027-01-01', '2027-01-02']), '2027-01-02').streak, 3);
  assert.strictEqual(L.addDays('2028-02-28', 1), '2028-02-29');
  assert.strictEqual(L.addDays('2027-02-28', 1), '2027-03-01');
});
t('el cupo de congeladores se cuenta por mes del día congelado (31 oct vs 1 nov)', () => {
  const st = mk('2026-11-02', ['2026-10-30'], ['2026-10-31']);
  st.sessions['2026-11-01'] = { type: 'A', minimal: false, ex: {} };
  assert.strictEqual(L.freezesLeft(st, '2026-10'), 1);
  assert.strictEqual(L.freezesLeft(st, '2026-11'), 2);
  assert.strictEqual(L.streakInfo(st, '2026-11-02').streak, 2);
});
t('daysInMonth y lunes como primer día de semana', () => {
  assert.strictEqual(L.daysInMonth('2028-02'), 29); assert.strictEqual(L.daysInMonth('2026-10'), 31);
  assert.strictEqual(L.weekStart('2026-10-07'), '2026-10-05');   // miércoles → lunes
  assert.strictEqual(L.weekStart('2026-10-11'), '2026-10-05');   // domingo → lunes anterior
});

console.log('Cambio de hora (America/Santiago)');
t('recorriendo hora a hora el DST de abril y septiembre, el día nunca salta ni se repite', () => {
  for (const startIso of ['2026-03-30T00:00:00Z', '2026-09-01T00:00:00Z']) {
    let ms = Date.parse(startIso), prev = L.dayKey(new Date(ms)); const seen = new Set([prev]);
    for (let h = 1; h <= 24 * 12; h++) {
      const k = L.dayKey(new Date(ms + h * 3600000));
      const d = L.diffDays(k, prev);
      assert.ok(d === 0 || d === 1, `salto de ${d} días en ${new Date(ms + h * 3600000).toISOString()}`);
      seen.add(k); prev = k;
    }
    assert.strictEqual(seen.size, 13);                                    // 12 días + 1: ninguno omitido
  }
});
t('la medianoche local cambia el día (incluye el instante del cambio de hora)', () => {
  // Pasada la medianoche local, aunque en UTC aún sea el día anterior
  const k1 = L.dayKey(new Date('2026-07-15T03:59:00Z')), k2 = L.dayKey(new Date('2026-07-15T04:01:00Z'));  // invierno UTC-4
  assert.strictEqual(L.diffDays(k2, k1), 1);
  // verano UTC-3: la medianoche cae a las 03:00Z
  const v1 = L.dayKey(new Date('2026-01-15T02:59:00Z')), v2 = L.dayKey(new Date('2026-01-15T03:01:00Z'));
  assert.strictEqual(L.diffDays(v2, v1), 1);
});
t('entrenar en cualquier hora alrededor de cada cambio de hora deja días consecutivos sin huecos', () => {
  // Una sesión por cada hora de 3 días en torno a cada transición real.
  for (const base of ['2026-04-03', '2026-04-04', '2026-09-05', '2026-09-06']) {
    const st = L.defaultState(base);
    for (let h = 0; h < 72; h++) {
      const d = new Date(Date.parse(base + 'T00:00:00Z') + h * 3600000);
      const k = L.dayKey(d); st.sessions[k] = { type: 'A', minimal: false, ex: {} };
    }
    const ks = Object.keys(st.sessions).sort();
    for (let i = 1; i < ks.length; i++) assert.strictEqual(L.diffDays(ks[i], ks[i - 1]), 1);
    assert.strictEqual(L.streakEndingAt(st, ks[ks.length - 1]), ks.length);
  }
});

console.log('Metas, progresión y rotación');
t('meta: semanas 1-3 → 2 sesiones; desde la 4 → 3', () => {
  const st = L.defaultState('2026-10-05');                       // lunes
  assert.strictEqual(L.weekGoal(st, '2026-10-05'), 2);
  assert.strictEqual(L.weekGoal(st, '2026-10-19'), 2);           // semana 3
  assert.strictEqual(L.weekGoal(st, '2026-10-26'), 3);           // semana 4
  assert.strictEqual(L.weekNumber(L.defaultState('2026-10-07'), '2026-10-05'), 1); // empezar a mitad de semana
});
t('A/B alterna por sesiones completas; el modo mínimo no la avanza', () => {
  const st = L.defaultState('2026-10-01');
  assert.strictEqual(L.nextType(st), 'A');
  st.sessions['2026-10-01'] = { type: 'A', minimal: false, ex: {} };
  assert.strictEqual(L.nextType(st), 'B');
  st.sessions['2026-10-02'] = { type: 'A', minimal: true, ex: {} };
  assert.strictEqual(L.nextType(st), 'B');
});
t('últimas repeticiones ignoran el modo mínimo; stats semanales suman reps sin plancha', () => {
  const st = L.defaultState('2026-10-05');
  st.sessions['2026-10-05'] = { type: 'A', minimal: false, ex: { flexiones: [8, 8, 7], plancha: [30, 30, null] } };
  st.sessions['2026-10-06'] = { type: 'A', minimal: true, ex: { flexiones: [10] } };
  assert.deepStrictEqual(L.lastReps(st, 'flexiones'), [8, 8, 7]);
  assert.deepStrictEqual(L.weekStats(st, '2026-10-05'), { sessions: 2, reps: 23 + 10 });
});
t('récord histórico se conserva tras romperse la racha', () => {
  const st = mk('2026-10-30', [...days('2026-10-01', 5), ...days('2026-10-20', 2), '2026-10-30']);
  const i = L.streakInfo(st, '2026-10-30'); assert.strictEqual(i.streak, 1); assert.strictEqual(i.best, 5);
});

console.log('Trayecto');
require('./guides.js');
const lessonSession = (id, extra) => Object.assign({ type: 'P', lesson: id, minimal: false, ex: {} }, extra || {});
t('23 lecciones, ids únicos, 4 unidades con jefe al final y ejercicios bien formados', () => {
  assert.strictEqual(L.LESSONS.length, 23);
  assert.strictEqual(new Set(L.LESSONS.map((l) => l.id)).size, 23);
  assert.strictEqual(L.UNITS.length, 4);
  L.UNITS.forEach((u) => { assert.ok(u.lessons[u.lessons.length - 1].boss); assert.strictEqual(u.lessons.filter((l) => l.boss).length, 1); });
  L.LESSONS.forEach((l) => l.exercises.forEach((e) => { assert.ok(e.sets >= 1 && e.def >= 1 && e.name && e.target, l.id + ' ' + e.id); }));
});
t('todo ejercicio usado (y de las rutinas A/B) tiene figura animada e instrucciones', () => {
  Object.keys(L.EX).forEach((id) => {
    assert.ok(GUIDES.ids.includes(id), 'sin figura: ' + id);
    assert.ok(GUIDES.html(id, 'x').includes('Cómo hacerlo'), 'sin texto: ' + id);
    assert.ok(GUIDES.figure(id).includes('<animate') || ['plancha', 'plancha-rod'].includes(id), 'sin animación: ' + id);
  });
});
t('la dificultad sube: más series/minutos y menos RIR a lo largo de las unidades', () => {
  const mins = L.UNITS.map((u) => u.lessons[u.lessons.length - 1].minutes);
  assert.deepStrictEqual(mins.slice().sort((a, b) => a - b), mins);
  assert.deepStrictEqual(L.UNITS.map((u) => u.rir), [5, 4, 3, 2]);
  assert.ok(L.LESSONS[0].minutes <= 15 && L.LESSONS[0].exercises.every((e) => e.sets <= 2));   // arranque suave desde cero
});
t('parseEx entiende segundos, por pierna y por lado', () => {
  assert.deepStrictEqual([L.parseEx('plancha:3x20s').target, L.parseEx('plancha:3x20s').unit], ['20 seg', 'seg']);
  assert.strictEqual(L.parseEx('zancadas:3x6p').target, '6 por pierna');
  assert.strictEqual(L.parseEx('plancha-lat:3x8l').target, '8 por lado');
  assert.throws(() => L.parseEx('inexistente:3x8'));
});
t('usuario nuevo: la lección de hoy es la 1.1; completarla avanza a la 1.2', () => {
  const st = L.defaultState('2026-10-05');
  assert.strictEqual(L.nextLesson(st).id, '1.1');
  assert.deepStrictEqual(L.todayPlan(st), { type: 'P', lesson: '1.1' });
  st.sessions['2026-10-05'] = lessonSession('1.1');
  assert.strictEqual(L.nextLesson(st).id, '1.2');
});
t('una sesión parcial o en modo mínimo cuenta para la racha pero NO avanza el trayecto', () => {
  const st = L.defaultState('2026-10-05');
  st.sessions['2026-10-05'] = lessonSession('1.1', { partial: true });
  st.sessions['2026-10-06'] = { type: 'A', minimal: true, ex: {} };
  assert.strictEqual(L.nextLesson(st).id, '1.1');
  assert.strictEqual(L.streakInfo(st, '2026-10-06').streak, 2);
});
t('al terminar las 23 lecciones el plan pasa a la rutina A/B; con el trayecto apagado, también', () => {
  const st = L.defaultState('2026-01-01');
  L.LESSONS.forEach((l, i) => { st.sessions[L.addDays('2026-01-01', i)] = lessonSession(l.id); });
  assert.strictEqual(L.nextLesson(st), null);
  assert.ok(['A', 'B'].includes(L.todayPlan(st).type));
  const st2 = L.defaultState('2026-10-05'); st2.settings.path = false;
  assert.strictEqual(L.todayPlan(st2).lesson, undefined);
});
t('routineFor devuelve lección, rutina A/B o modo mínimo; las lecciones se guardan con reps contadas en el gráfico', () => {
  assert.strictEqual(L.routineFor({ lesson: '2.3' }).id, '2.3');
  assert.strictEqual(L.routineFor({ type: 'B' }), L.ROUTINES.B);
  assert.strictEqual(L.routineFor({ minimal: true, lesson: '2.3' }), L.MINIMAL);
  assert.strictEqual(L.sessionReps({ ex: { 'plancha-rod': [20, 20], 'flex-rod': [6, 6] } }), 12);   // segundos no suman
});

console.log('Descanso activo, registro tardío y recomendación del día');
const ses = (type, extra) => Object.assign({ type, minimal: false, ex: {} }, extra || {});
t('una caminata cuenta para la racha pero no para la meta semanal ni para la rotación A/B', () => {
  const st = L.defaultState('2026-10-05');
  st.sessions['2026-10-05'] = ses('A'); st.sessions['2026-10-06'] = ses('W'); st.sessions['2026-10-07'] = ses('B');
  assert.strictEqual(L.streakInfo(st, '2026-10-07').streak, 3);
  assert.strictEqual(L.weekStats(st, '2026-10-05').sessions, 2);
  assert.strictEqual(L.nextType(st), 'A');
});
t('día perdido + caminata hoy: la racha reinicia en 1 (la caminata salva hoy, no ayer)', () => {
  const st = L.defaultState('2026-10-01');
  st.sessions['2026-10-04'] = ses('A'); st.sessions['2026-10-06'] = ses('W');
  assert.strictEqual(L.streakInfo(st, '2026-10-06').streak, 1);
});
t('registrar ayer (olvidado) recupera la racha y suma a la meta semanal', () => {
  const st = L.defaultState('2026-10-01');
  st.sessions['2026-10-05'] = ses('A');
  assert.strictEqual(L.streakInfo(st, '2026-10-07').lost, true);
  st.sessions['2026-10-06'] = ses('R');
  const i = L.streakInfo(st, '2026-10-07');
  assert.strictEqual(i.lost, false); assert.strictEqual(i.streak, 2);
  assert.strictEqual(L.weekStats(st, '2026-10-05').sessions, 2);
});
t('recomendación: semana de meta 3 queda L-Mi-V entrenar y el resto descanso activo', () => {
  const st = L.defaultState('2026-09-07');                       // así la semana del 5 oct es la 5ª (meta 3)
  assert.strictEqual(L.weekGoal(st, '2026-10-05'), 3);
  const plan = {};
  for (let d = 0; d < 7; d++) {
    const k = L.addDays('2026-10-05', d), a = L.dayAdvice(st, k);
    plan[k] = a;
    st.sessions[k] = ses(a === 'train' ? 'A' : 'W');
  }
  assert.deepStrictEqual(Object.values(plan), ['train', 'rest', 'train', 'rest', 'train', 'rest', 'rest']);
});
t('recomendación: si se atrasó la semana, pide entrenar aunque ayer entrenaste', () => {
  const st = L.defaultState('2026-09-07');
  st.sessions['2026-10-10'] = ses('A');                          // sábado; meta 3, lleva 1
  assert.strictEqual(L.dayAdvice(st, '2026-10-11'), 'train');    // domingo: necesita 2 y solo queda hoy
  assert.strictEqual(L.dayAdvice(L.defaultState('2026-10-05'), '2026-10-05'), 'train');   // primer día
});
t('modo mínimo ayer no cuenta como "ya entrenaste": hoy recomienda entrenar', () => {
  const st = L.defaultState('2026-09-07');
  st.sessions['2026-10-05'] = ses('A', { minimal: true });
  assert.strictEqual(L.dayAdvice(st, '2026-10-06'), 'train');
});

console.log('Semanas perfectas y logros');
t('semanas perfectas: la semana en curso no corta la cadena si aún no se cumple', () => {
  const st = L.defaultState('2026-09-21');                       // semanas 1-3 con meta 2
  ['2026-09-21', '2026-09-23', '2026-09-28', '2026-09-30'].forEach((k) => { st.sessions[k] = ses('A'); });
  assert.strictEqual(L.perfectWeeks(st, '2026-10-06'), 2);       // semana actual (3ª) aún sin cumplir
  st.sessions['2026-10-05'] = ses('A'); st.sessions['2026-10-07'] = ses('B');
  assert.strictEqual(L.perfectWeeks(st, '2026-10-07'), 3);
  assert.strictEqual(L.bestPerfectWeeks(st, '2026-10-20'), 3);   // luego falla la 4ª: el mejor queda en 3
  assert.strictEqual(L.perfectWeeks(st, '2026-10-20'), 0);
});
t('logros: se desbloquean por historial y no se pierden al romper la racha', () => {
  const st = L.defaultState('2026-10-01');
  const got = (today) => L.achievements(st, today).filter((a) => a.got).map((a) => a.id);
  assert.deepStrictEqual(got('2026-10-01'), []);
  ['2026-10-01', '2026-10-02', '2026-10-03'].forEach((k) => { st.sessions[k] = ses('P', { lesson: '1.1', ex: { 'flex-pared': [8, 8] } }); });
  assert.ok(got('2026-10-03').includes('racha3') && got('2026-10-03').includes('leccion') && got('2026-10-03').includes('primera'));
  assert.ok(!got('2026-10-03').includes('regreso'));
  st.sessions['2026-10-06'] = ses('A', { minimal: true, ex: { flexiones: [10] } });  // día perdido y vuelta en mínimo
  const g = got('2026-10-06');
  assert.ok(g.includes('racha3') && g.includes('regreso') && g.includes('minimo'));
  assert.ok(!g.includes('flexion'));                            // las flexiones del modo mínimo no cuentan
  st.sessions['2026-10-07'] = ses('A', { ex: { flexiones: [3, 2, 0] } });
  assert.ok(got('2026-10-07').includes('flexion'));
  assert.strictEqual(L.achievements(st, '2026-10-07').length, 22);
});

console.log(`\n${passed} pruebas OK`);
