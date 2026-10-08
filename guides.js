/* =====================================================================
   Guías de ejercicios: figura animada (SVG + SMIL, sin librerías) e instrucciones.
   Cada figura es un "muñeco de palitos" de perfil mirando a la derecha, con dos poses
   (A = inicio, B = punto más exigente) entre las que se interpola.
   Pose: { head:[x,y], torso:[hombro,cadera], arm:[hombro,codo,mano],
           leg:[cadera,rodilla,pie], leg2?:[...], load?:[x,y,r] }
   ===================================================================== */
(function (root) {
  'use strict';

  const stand = [[100, 49], [98, 79], [96, 108]];                       // pierna de pie
  const lying = { torso: [[40, 104], [80, 104]], arm: [[40, 104], [58, 106], [76, 106]], head: [26, 101] };
  const FLOOR = '<line class="floor" x1="0" y1="108" x2="200" y2="108"/>';

  const FIG = {
    flexiones: {
      vb: '0 30 200 84',
      hl: ['torso', 'arm'], props: FLOOR,
      A: { head: [138, 50], torso: [[125, 56], [75, 80]], arm: [[125, 56], [127, 80], [128, 105]], leg: [[75, 80], [50, 92], [25, 105]] },
      B: { head: [138, 86], torso: [[125, 90], [75, 97]], arm: [[125, 90], [107, 98], [128, 105]], leg: [[75, 97], [50, 101], [25, 105]] }
    },
    sentadilla: {
      hl: ['leg'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [108, 32], [114, 30]], leg: stand, load: [119, 31, 7] },
      B: { head: [108, 46], torso: [[103, 55], [86, 80]], arm: [[103, 55], [113, 66], [123, 57]], leg: [[86, 80], [115, 86], [96, 108]], load: [128, 59, 7] }
    },
    remo: {
      hl: ['arm', 'torso'], props: FLOOR,
      A: { head: [127, 38], torso: [[116, 42], [88, 52]], arm: [[116, 42], [116, 62], [116, 80]], leg: [[88, 52], [100, 80], [96, 108]], load: [116, 87, 6] },
      B: { head: [127, 38], torso: [[116, 42], [88, 52]], arm: [[116, 42], [100, 48], [112, 60]], leg: [[88, 52], [100, 80], [96, 108]], load: [112, 66, 6] }
    },
    press: {
      hl: ['arm'], props: FLOOR,
      A: { head: [102, 8], torso: [[100, 19], [100, 49]], arm: [[100, 19], [108, 34], [110, 20]], leg: stand, load: [110, 17, 5] },
      B: { head: [102, 8], torso: [[100, 19], [100, 49]], arm: [[100, 19], [112, 4], [114, -13]], leg: stand, load: [114, -16, 5] }
    },
    plancha: {
      vb: '0 40 200 76',
      hl: ['torso'], still: true,
      props: FLOOR + '<line class="guide" x1="18" y1="94" x2="150" y2="58"/>',
      A: { head: [138, 72], torso: [[125, 78], [75, 90]], arm: [[125, 78], [125, 104], [150, 104]], leg: [[75, 90], [50, 97], [25, 104]] }
    },
    fondos: {
      vb: '0 18 200 96',
      hl: ['arm'],
      props: FLOOR + '<g class="prop"><rect x="36" y="70" width="34" height="5" rx="2"/><rect x="36" y="28" width="5" height="44" rx="2"/>' +
        '<rect x="38" y="75" width="4" height="33"/><rect x="64" y="75" width="4" height="33"/></g>',
      A: { head: [72, 32], torso: [[70, 42], [80, 71]], arm: [[70, 42], [60, 56], [62, 68]], leg: [[80, 71], [108, 78], [112, 106]] },
      B: { head: [75, 54], torso: [[73, 64], [83, 92]], arm: [[73, 64], [54, 78], [62, 68]], leg: [[83, 92], [110, 86], [112, 106]] }
    },
    zancadas: {
      hl: ['leg'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [90, 32], [98, 44]], leg: [[100, 49], [104, 79], [106, 106]], leg2: [[100, 49], [96, 79], [90, 106]] },
      B: { head: [99, 27], torso: [[98, 36], [98, 66]], arm: [[98, 36], [88, 48], [96, 60]], leg: [[98, 66], [124, 70], [124, 106]], leg2: [[98, 66], [80, 92], [52, 106]] }
    },
    'remo-inv': {
      vb: '0 40 200 76',
      hl: ['arm', 'torso'],
      props: FLOOR + '<g class="prop"><rect x="95" y="56" width="95" height="6" rx="2"/><rect x="98" y="62" width="5" height="46"/><rect x="184" y="62" width="5" height="46"/></g>',
      A: { head: [131, 99], torso: [[118, 97], [69, 102]], arm: [[118, 97], [117, 80], [116, 64]], leg: [[69, 102], [45, 105], [20, 106]] },
      B: { head: [131, 73], torso: [[118, 76], [69, 91]], arm: [[118, 76], [128, 82], [116, 64]], leg: [[69, 91], [45, 99], [20, 106]] }
    },
    puente: {
      vb: '0 40 200 76',
      hl: ['leg', 'torso'], props: FLOOR,
      A: Object.assign({}, lying, { leg: [[80, 104], [102, 80], [122, 106]] }),
      B: Object.assign({}, lying, { torso: [[40, 104], [78, 86]], leg: [[78, 86], [106, 80], [122, 106]] })
    },
    'elev-piernas': {
      vb: '0 30 200 86',
      hl: ['leg', 'torso'], props: FLOOR,
      A: Object.assign({}, lying, { leg: [[80, 104], [110, 100], [140, 97]] }),
      B: Object.assign({}, lying, { leg: [[80, 104], [80, 74], [80, 44]] })
    }
  };

  const TEXT = {
    flexiones: {
      muscles: 'Pecho · hombros · tríceps · core',
      steps: ['Manos un poco más anchas que los hombros, cuerpo recto de cabeza a talones. Aprieta abdomen y glúteos.',
        'Baja controlado (unos 2 seg) hasta que el pecho casi roce el suelo. Codos a unos 45° del cuerpo, no abiertos en «T».',
        'Empuja el suelo hasta estirar los brazos sin bloquear los codos.',
        'Exhala al subir, inhala al bajar.'],
      mistakes: ['Cadera caída o levantada', 'Codos muy abiertos', 'Bajar solo la mitad', 'Cuello caído hacia adelante'],
      tip: 'Si te cuesta, apoya las rodillas o las manos en una mesa o sofá. Hacerlas bien con ayuda vale más que mal sin ella.'
    },
    sentadilla: {
      muscles: 'Cuádriceps · glúteos · core',
      steps: ['Pies al ancho de hombros, puntas un poco hacia afuera. Abraza la mochila contra el pecho.',
        'Baja llevando la cadera hacia atrás, como si te sentaras en una silla. Pecho arriba y espalda recta.',
        'Baja hasta que los muslos queden paralelos al suelo, con las rodillas siguiendo la dirección de los pies.',
        'Sube empujando con los talones y aprieta glúteos arriba.'],
      mistakes: ['Rodillas que se van hacia adentro', 'Talones que se despegan', 'Espalda redondeada'],
      tip: 'Cuando se vuelva fácil, carga más la mochila con libros antes de subir las repeticiones.'
    },
    remo: {
      muscles: 'Espalda · bíceps · hombro posterior',
      steps: ['Inclina el torso hacia adelante desde la cadera (unos 45°), rodillas semiflexionadas, espalda recta y mirada al suelo.',
        'Deja el brazo colgando con la mochila o mancuerna. Apoya la otra mano en una silla o en el muslo.',
        'Tira llevando el codo hacia la cadera y junta el omóplato. Pausa 1 seg arriba.',
        'Baja lento. Con mancuerna, haz las repeticiones de un lado y luego del otro.'],
      mistakes: ['Redondear la espalda', 'Dar tirones con impulso', 'Girar el torso al subir'],
      tip: 'Imagina que el codo es una manilla que arrancas hacia atrás; el brazo solo es un gancho.'
    },
    press: {
      muscles: 'Hombros · tríceps · core',
      steps: ['De pie, pies al ancho de caderas. Lleva el peso a la altura de los hombros, codos un poco adelante.',
        'Aprieta abdomen y glúteos para no arquear la zona lumbar.',
        'Empuja hacia arriba en línea recta hasta estirar los brazos, con el peso sobre la cabeza.',
        'Baja controlado hasta los hombros. Exhala al subir.'],
      mistakes: ['Arquear la espalda baja', 'Empujar hacia adelante en vez de arriba', 'Ayudarte con las piernas'],
      tip: 'Sin mancuernas puedes usar la mochila con ambas manos o dos botellas de agua.'
    },
    plancha: {
      muscles: 'Abdomen · core · hombros',
      steps: ['Antebrazos en el suelo con los codos justo bajo los hombros. Apóyate en las puntas de los pies.',
        'Cuerpo en línea recta, como una tabla, de cabeza a talones (sigue la línea punteada). Mirada al suelo.',
        'Aprieta abdomen y glúteos. Respira normal, sin aguantar el aire.',
        'Anota los segundos que aguantaste con buena postura.'],
      mistakes: ['Cadera caída (duele la espalda baja)', 'Cadera muy arriba', 'Aguantar la respiración'],
      tip: 'Si 30 seg es mucho, empieza con las rodillas apoyadas. Termina la serie cuando la postura se rompa.'
    },
    fondos: {
      muscles: 'Tríceps · pecho · hombros',
      steps: ['Usa una silla estable, apoyada contra la pared. Manos en el borde del asiento, dedos hacia adelante, cadera pegada a la silla.',
        'Rodillas dobladas (más fácil) o piernas estiradas (más difícil).',
        'Baja doblando los codos hacia atrás hasta unos 90°, con la espalda cerca de la silla.',
        'Sube estirando los brazos, sin encoger los hombros hacia las orejas.'],
      mistakes: ['Bajar más de 90° (castiga el hombro)', 'Codos abiertos hacia los lados', 'Cadera lejos de la silla'],
      tip: 'Comprueba que la silla no se mueva ni tenga ruedas antes de empezar.'
    },
    zancadas: {
      muscles: 'Cuádriceps · glúteos · equilibrio',
      steps: ['De pie, da un paso largo hacia adelante. Torso erguido, manos en la cadera.',
        'Baja recto hasta que ambas rodillas formen unos 90°. La rodilla de atrás casi roza el suelo.',
        'La rodilla de adelante queda sobre el tobillo, sin pasarse mucho de la punta del pie.',
        'Empuja con el talón del pie delantero para volver. Haz todas las repeticiones y cambia de pierna.'],
      mistakes: ['Paso demasiado corto', 'Torso inclinado hacia adelante', 'Rodilla delantera que se va hacia adentro'],
      tip: 'Si pierdes el equilibrio, apoya una mano en una pared o silla.'
    },
    'remo-inv': {
      muscles: 'Espalda · bíceps · core',
      steps: ['Usa una mesa pesada y estable (sin ruedas ni vidrio). Túmbate debajo y agarra el borde.',
        'Cuerpo recto de hombros a talones, con los talones apoyados en el suelo.',
        'Tira llevando el pecho hacia el borde de la mesa y junta los omóplatos.',
        'Baja lento hasta estirar los brazos. Haz tantas como puedas con buena técnica.'],
      mistakes: ['Cadera caída', 'Tirar solo con los brazos', 'Usar una mesa inestable'],
      tip: 'Más fácil: dobla las rodillas y apoya los pies. Más difícil: eleva los pies sobre un cojín.'
    },
    puente: {
      muscles: 'Glúteos · isquiotibiales · zona lumbar',
      steps: ['Boca arriba, rodillas dobladas, pies al ancho de caderas y cerca de los glúteos. Brazos al costado.',
        'Empuja con los talones y sube la cadera hasta formar una línea recta de hombros a rodillas.',
        'Aprieta los glúteos 1-2 seg arriba.',
        'Baja lento sin apoyar del todo la cadera.'],
      mistakes: ['Arquear la zona lumbar', 'Empujar con las puntas de los pies', 'Rodillas que se abren o cierran'],
      tip: 'Debes sentir el trabajo en glúteos. Si lo sientes en la espalda baja, sube menos y aprieta más.'
    },
    'elev-piernas': {
      muscles: 'Abdomen bajo · flexores de cadera',
      steps: ['Boca arriba, manos bajo la cadera. Pega la zona lumbar al suelo.',
        'Piernas juntas y casi estiradas. Súbelas hasta la vertical.',
        'Baja despacio sin que los pies toquen el suelo.',
        'Exhala al subir. Si la espalda baja se despega, detente.'],
      mistakes: ['Zona lumbar que se arquea', 'Bajar rápido', 'Subir con impulso'],
      tip: 'Si te molesta la espalda baja, dobla las rodillas o baja solo hasta la mitad.'
    }
  };

  const pts = (a) => a.map((p) => p.join(',')).join(' ');
  /** <animate> que va A → B → pausa → A → pausa, suave. */
  const anim = (attr, a, b, dur) =>
    `<animate attributeName="${attr}" values="${a};${b};${b};${a};${a}" keyTimes="0;.4;.5;.9;1" calcMode="spline" ` +
    'keySplines=".45 0 .55 1;0 0 1 1;.45 0 .55 1;0 0 1 1" ' + `dur="${dur}s" repeatCount="indefinite"/>`;

  /** SVG del ejercicio. opts.still = 'A' | 'B' dibuja una pose fija (sin animación). */
  function figure(id, opts) {
    const f = FIG[id]; if (!f) return '';
    const o = opts || {};
    const reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const still = o.still || (f.still || reduced ? 'A' : null);
    const A = f.A, B = f.B || f.A, dur = 3.6;
    const P = still === 'B' ? B : A;
    const animate = !still && !!f.B;
    const poly = (part, cls) => {
      if (!P[part]) return '';
      const a = pts(A[part]), b = pts(B[part]), hl = f.hl.includes(part) ? ' hl' : '';
      return `<polyline class="body ${cls || part}${hl}" points="${pts(P[part])}">${animate ? anim('points', a, b, dur) : ''}</polyline>`;
    };
    const circ = (part, cls, r) => {
      if (!P[part]) return '';
      const c = P[part], a = A[part], b = B[part];
      return `<circle class="${cls}" cx="${c[0]}" cy="${c[1]}" r="${r || c[2]}">` +
        (animate ? anim('cx', a[0], b[0], dur) + anim('cy', a[1], b[1], dur) : '') + '</circle>';
    };
    return `<svg class="fig" viewBox="${f.vb || '0 -22 200 142'}" role="img" aria-label="Animación del ejercicio">${f.props}` +
      poly('leg2') + poly('leg') + poly('torso') + poly('arm') + circ('head', 'head', 7) + circ('load', 'load') + '</svg>';
  }

  /** HTML completo de la guía (para el modal). */
  function html(id, name) {
    const t = TEXT[id]; if (!t) return '';
    return `<h2>${name}</h2>${figure(id)}<div class="muscles">💪 ${t.muscles}</div>` +
      `<h3>Cómo hacerlo</h3><ol class="steps">${t.steps.map((s) => `<li>${s}</li>`).join('')}</ol>` +
      `<h3>Errores comunes</h3><ul class="steps bad">${t.mistakes.map((s) => `<li>${s}</li>`).join('')}</ul>` +
      `<div class="banner info">💡 ${t.tip}</div>` +
      '<small>Si sientes dolor agudo (no el cansancio normal del músculo), detente.</small>';
  }

  root.GUIDES = { figure, html, ids: Object.keys(FIG) };
})(typeof window !== 'undefined' ? window : globalThis);
