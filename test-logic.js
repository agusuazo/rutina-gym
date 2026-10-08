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

console.log(`\n${passed} pruebas OK`);
