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
    },

    'sent-aire': {
      hl: ['leg'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [112, 24], [124, 26]], leg: stand },
      B: { head: [108, 46], torso: [[103, 55], [86, 80]], arm: [[103, 55], [117, 52], [130, 50]], leg: [[86, 80], [115, 86], [96, 108]] }
    },
    'flex-pared': {
      hl: ['torso', 'arm'], props: '<line class="floor" x1="0" y1="108" x2="200" y2="108"/><line class="floor" x1="140" y1="-22" x2="140" y2="108"/>',
      A: { head: [110, 24], torso: [[104, 34], [92, 66]], arm: [[104, 34], [120, 32], [136, 30]], leg: [[92, 66], [86, 88], [80, 108]] },
      B: { head: [128, 30], torso: [[122, 38], [104, 68]], arm: [[122, 38], [126, 46], [136, 30]], leg: [[104, 68], [92, 90], [80, 108]] }
    },
    'flex-incl': {
      vb: '0 24 200 90', hl: ['torso', 'arm'],
      props: FLOOR + '<g class="prop"><rect x="110" y="83" width="38" height="5" rx="2"/><rect x="113" y="88" width="4" height="20"/><rect x="141" y="88" width="4" height="20"/></g>',
      A: { head: [134, 44], torso: [[122, 50], [76, 78]], arm: [[122, 50], [124, 66], [126, 82]], leg: [[76, 78], [53, 92], [30, 105]] },
      B: { head: [134, 66], torso: [[122, 72], [76, 89]], arm: [[122, 72], [108, 80], [126, 82]], leg: [[76, 89], [53, 97], [30, 105]] }
    },
    'flex-rod': {
      vb: '0 30 200 84', hl: ['torso', 'arm'], props: FLOOR,
      A: { head: [138, 54], torso: [[125, 60], [91, 83]], arm: [[125, 60], [127, 82], [128, 105]], leg: [[91, 83], [58, 105], [38, 92]] },
      B: { head: [138, 88], torso: [[125, 92], [91, 98]], arm: [[125, 92], [107, 99], [128, 105]], leg: [[91, 98], [58, 105], [38, 94]] }
    },
    'plancha-rod': {
      vb: '0 40 200 76', hl: ['torso'], still: true,
      props: FLOOR + '<line class="guide" x1="50" y1="99" x2="140" y2="68"/>',
      A: { head: [138, 76], torso: [[125, 82], [93, 92]], arm: [[125, 82], [125, 104], [150, 104]], leg: [[93, 92], [60, 104], [40, 90]] }
    },
    'plancha-lat': {
      vb: '0 30 200 84', hl: ['torso'], props: FLOOR,
      A: { head: [50, 76], torso: [[62, 80], [108, 88]], arm: [[62, 80], [62, 104], [84, 104]], leg: [[108, 88], [130, 97], [152, 105]], leg2: [[62, 80], [62, 60], [62, 42]] },
      B: { head: [50, 76], torso: [[62, 80], [108, 88]], arm: [[62, 80], [62, 104], [84, 104]], leg: [[108, 88], [130, 97], [152, 105]], leg2: [[62, 80], [72, 90], [92, 94]] }
    },
    superman: {
      vb: '0 60 200 54', hl: ['arm', 'leg', 'torso'], props: FLOOR,
      A: { head: [125, 101], torso: [[110, 104], [70, 104]], arm: [[110, 104], [128, 104], [146, 104]], leg: [[70, 104], [45, 104], [20, 104]] },
      B: { head: [125, 94], torso: [[110, 104], [70, 104]], arm: [[110, 104], [128, 94], [146, 84]], leg: [[70, 104], [45, 98], [20, 92]] }
    },
    'abd-talones': {
      vb: '0 50 200 64', hl: ['torso'], props: FLOOR,
      A: Object.assign({}, lying, { leg: [[80, 104], [102, 80], [122, 106]] }),
      B: { head: [40, 82], torso: [[48, 88], [80, 104]], arm: [[48, 88], [70, 92], [92, 96]], leg: [[80, 104], [102, 80], [122, 106]] }
    },
    'peso-muerto': {
      hl: ['leg', 'torso'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [104, 36], [106, 53]], leg: stand, load: [106, 60, 6] },
      B: { head: [126, 44], torso: [[114, 46], [84, 58]], arm: [[114, 46], [114, 66], [114, 86]], leg: [[84, 58], [94, 82], [96, 108]], load: [114, 92, 6] }
    },
    'elev-talones': {
      hl: ['leg'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [100, 36], [100, 52]], leg: stand },
      B: { head: [101, 2], torso: [[100, 11], [100, 41]], arm: [[100, 11], [100, 28], [100, 44]], leg: [[100, 41], [98, 71], [96, 100]] }
    },
    'puente-peso': {
      vb: '0 50 200 64', hl: ['leg', 'torso'], props: FLOOR,
      A: Object.assign({}, lying, { leg: [[80, 104], [102, 80], [122, 106]], load: [80, 97, 6] }),
      B: Object.assign({}, lying, { torso: [[40, 104], [78, 86]], leg: [[78, 86], [106, 80], [122, 106]], load: [78, 79, 6] })
    },
    curl: {
      hl: ['arm'], props: FLOOR,
      A: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [102, 40], [104, 60]], leg: stand, load: [105, 67, 6] },
      B: { head: [101, 10], torso: [[100, 19], [100, 49]], arm: [[100, 19], [102, 40], [118, 30]], leg: stand, load: [123, 29, 6] }
    },
    bulgara: {
      hl: ['leg'],
      props: FLOOR + '<g class="prop"><rect x="30" y="75" width="30" height="5" rx="2"/><rect x="32" y="80" width="4" height="28"/><rect x="54" y="80" width="4" height="28"/></g>',
      A: { head: [95, 9], torso: [[94, 18], [94, 48]], arm: [[94, 18], [84, 31], [92, 43]], leg: [[94, 48], [108, 78], [116, 108]], leg2: [[94, 48], [72, 64], [52, 73]] },
      B: { head: [95, 37], torso: [[94, 46], [94, 76]], arm: [[94, 46], [84, 59], [92, 71]], leg: [[94, 76], [120, 78], [116, 108]], leg2: [[94, 76], [74, 88], [52, 73]] }
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
    },

    'sent-aire': {
      muscles: 'Piernas · glúteos',
      steps: ['Pies al ancho de hombros, puntas un poco hacia afuera. Estira los brazos al frente para equilibrarte.',
        'Baja llevando la cadera hacia atrás, como si te sentaras. Pecho arriba y espalda recta.',
        'Baja hasta donde puedas con la espalda recta (la meta es llegar a muslos paralelos al suelo).',
        'Sube empujando con los talones.'],
      mistakes: ['Rodillas hacia adentro', 'Talones que se despegan', 'Espalda redondeada'],
      tip: 'Si te cuesta el equilibrio, déjate una silla detrás y toca el asiento con los glúteos sin sentarte del todo.'
    },
    'flex-pared': {
      muscles: 'Pecho · hombros · tríceps',
      steps: ['De pie frente a una pared, a un paso de distancia. Manos a la altura del pecho, un poco más anchas que los hombros.',
        'Cuerpo recto de cabeza a talones, abdomen apretado.',
        'Dobla los codos y acerca el pecho a la pared sin despegar los talones.',
        'Empuja la pared hasta estirar los brazos.'],
      mistakes: ['Cadera hacia atrás (cuerpo doblado)', 'Codos muy abiertos', 'Cuello caído'],
      tip: 'Cuanto más lejos pongas los pies de la pared, más difícil. Cuando te sobren 12 repeticiones, pasa a las inclinadas con silla.'
    },
    'flex-incl': {
      muscles: 'Pecho · hombros · tríceps · core',
      steps: ['Manos en el borde de una silla firme o mesa (apoyada contra la pared), un poco más anchas que los hombros.',
        'Cuerpo recto de cabeza a talones, abdomen y glúteos apretados.',
        'Baja el pecho hacia el borde con los codos a unos 45° del cuerpo.',
        'Empuja hasta estirar los brazos.'],
      mistakes: ['Cadera caída', 'Silla que se mueve (usa una estable)', 'Medio recorrido'],
      tip: 'Más fácil: apoya las manos en una superficie más alta. Más difícil: una más baja, hasta llegar al suelo.'
    },
    'flex-rod': {
      muscles: 'Pecho · hombros · tríceps · core',
      steps: ['Apoya manos y rodillas (con algo blando bajo las rodillas). Manos un poco más anchas que los hombros.',
        'Cuerpo recto desde las rodillas hasta la cabeza, abdomen apretado.',
        'Baja el pecho casi hasta el suelo con los codos a 45°.',
        'Empuja hasta estirar los brazos sin bloquear los codos.'],
      mistakes: ['Cadera hacia atrás o muy arriba', 'Codos en «T»', 'Bajar solo un poco'],
      tip: 'Cuando hagas 10 buenas seguidas, prueba las flexiones normales de a pocas.'
    },
    'plancha-rod': {
      muscles: 'Abdomen · core · hombros',
      steps: ['Antebrazos en el suelo, codos bajo los hombros, rodillas apoyadas.',
        'Cuerpo en línea recta de rodillas a cabeza (sigue la línea punteada). Mirada al suelo.',
        'Aprieta abdomen y glúteos. Respira normal.',
        'Anota los segundos que aguantaste con buena postura.'],
      mistakes: ['Cadera caída', 'Cadera muy arriba', 'Aguantar la respiración'],
      tip: 'Cuando aguantes 30 seg con facilidad, prueba la plancha completa.'
    },
    'plancha-lat': {
      muscles: 'Oblicuos · core · hombros',
      steps: ['De lado, apoyado en el antebrazo con el codo bajo el hombro. Pies uno sobre otro (o uno delante del otro, más fácil).',
        'Levanta la cadera hasta formar una línea recta de cabeza a pies. El otro brazo apunta al techo.',
        'Gira el tronco pasando ese brazo por debajo del cuerpo, sin dejar caer la cadera.',
        'Vuelve arriba. Haz todas las repeticiones de un lado y luego del otro.'],
      mistakes: ['Cadera caída', 'Girar demasiado rápido', 'Hombro encogido hacia la oreja'],
      tip: 'Si es muy difícil, apoya la rodilla de abajo en el suelo.'
    },
    superman: {
      muscles: 'Espalda baja y alta · glúteos',
      steps: ['Boca abajo, brazos estirados al frente y piernas estiradas.',
        'Levanta a la vez un brazo y la pierna contraria unos centímetros. Mirada al suelo.',
        'Mantén 1 seg apretando espalda y glúteos.',
        'Baja con control y alterna de lado.'],
      mistakes: ['Levantar el cuello y mirar al frente', 'Subir con impulso', 'Subir demasiado y arquear la espalda baja'],
      tip: 'No necesitas subir mucho: lo importante es apretar y controlar.'
    },
    'abd-talones': {
      muscles: 'Abdomen · oblicuos',
      steps: ['Boca arriba, rodillas dobladas y pies apoyados. Brazos a los costados.',
        'Levanta los hombros del suelo y estira las manos hacia los talones, primero un lado y luego el otro.',
        'Aprieta el abdomen arriba, sin tirar del cuello.',
        'Baja lento. Cada vez que toques un talón cuenta como repetición.'],
      mistakes: ['Tirar del cuello con las manos', 'Subir con impulso', 'Despegar los pies del suelo'],
      tip: 'Mira al techo y piensa en acercar las costillas a la cadera.'
    },
    'peso-muerto': {
      muscles: 'Glúteos · isquiotibiales · espalda baja',
      steps: ['De pie, mochila cargada con ambas manos delante de los muslos. Rodillas un poco dobladas.',
        'Lleva la cadera hacia atrás (como cerrando una puerta con el trasero) y baja la mochila pegada a las piernas.',
        'Baja hasta sentir el tirón atrás de los muslos, con la espalda siempre recta.',
        'Sube empujando la cadera hacia adelante y aprieta los glúteos.'],
      mistakes: ['Espalda redondeada', 'Doblar demasiado las rodillas (es una sentadilla)', 'Mochila lejos del cuerpo'],
      tip: 'Mira un punto en el suelo unos metros adelante, así mantienes el cuello alineado.'
    },
    'elev-talones': {
      muscles: 'Pantorrillas',
      steps: ['De pie, pies al ancho de caderas. Puedes apoyar una mano en la pared para equilibrarte.',
        'Sube lo más alto posible sobre la punta de los pies.',
        'Mantén 1 seg arriba.',
        'Baja lento hasta que los talones toquen el suelo.'],
      mistakes: ['Rebotar sin control', 'Tobillos que se doblan hacia afuera', 'Recorrido corto'],
      tip: 'Para más dificultad, hazlas con una sola pierna o con la mochila.'
    },
    'puente-peso': {
      muscles: 'Glúteos · isquiotibiales',
      steps: ['Boca arriba, rodillas dobladas, pies al ancho de caderas. Apoya la mochila sobre la cadera sujetándola con las manos.',
        'Empuja con los talones y sube la cadera hasta formar una línea recta de hombros a rodillas.',
        'Aprieta los glúteos 1-2 seg arriba.',
        'Baja lento sin apoyar del todo la cadera.'],
      mistakes: ['Arquear la zona lumbar', 'Empujar con las puntas de los pies', 'Rodillas hacia adentro o afuera'],
      tip: 'Para más intensidad apoya la parte alta de la espalda en el sofá (hip thrust).'
    },
    curl: {
      muscles: 'Bíceps · antebrazos',
      steps: ['De pie, mochila colgando de una mano (por el asa) con el brazo estirado. Codo pegado al costado.',
        'Sube la mochila doblando el codo, sin mover el hombro.',
        'Aprieta el bíceps arriba 1 seg.',
        'Baja lento hasta estirar el brazo. Haz el otro lado.'],
      mistakes: ['Balancear el cuerpo para subir', 'Codo que se va hacia adelante', 'Bajar de golpe'],
      tip: 'Si la mochila es liviana, sube y baja más lento: el control hace el trabajo.'
    },
    bulgara: {
      muscles: 'Cuádriceps · glúteos · equilibrio',
      steps: ['De espaldas a una silla firme, apoya el empeine de un pie sobre el asiento. El pie de adelante a un paso largo.',
        'Torso erguido. Baja doblando la rodilla de adelante hasta unos 90°.',
        'La rodilla de adelante queda sobre el tobillo, sin irse hacia adentro.',
        'Sube empujando con el talón de adelante. Haz todas las repeticiones y cambia de pierna.'],
      mistakes: ['Pie delantero demasiado cerca de la silla', 'Torso muy inclinado', 'Apoyar el peso en la pierna de atrás'],
      tip: 'Si te cuesta el equilibrio, apóyate con una mano en la pared.'
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
