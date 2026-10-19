// English and French for every word the page shows: the page itself and the sheet.
// Numbers follow the language (12.2 m / 12,2 m).

export const STR = {
  en: {
    title: 'Platform 593',
    description: 'Platform 593, Achrafieh, Beirut. A walk that starts on the floor plan, crosses the flat and its terrace at sunset, and returns to the plan.',
    canvas: 'Platform 593: from the floor plan, through the flat and out to the terrace, then back to the plan',
    markSub: 'Achrafieh, Beirut · first floor',
    hint: 'Scroll to walk through',
    hintHow: 'Mouse wheel, two fingers on the trackpad, or the arrow keys',
    hintTouch: 'Swipe up to walk through',
    hintTouchHow: 'Slide one finger up the screen',
    loader: 'Drawing the plan',
    langLabel: 'Language',
    fallback: 'This walk needs WebGL, which this browser does not offer. Here is the plan instead.',
    caps: [
      ['01 — The sheet', 'The first floor, cut at 1.20 m. Every line here is the model.'],
      ['02 — The walls rise', 'The cut climbs from 1.20 m to the 2.80 m ceiling.'],
      ['03 — The landing', 'Stairs and lift. The front door is 1.00 m wide.'],
      ['04 — The door', 'It opens inward, and the drawing gives way.'],
      ['05 — The hall', ({ hall, line }) => `${n(hall, 1)} m² of white marble, and one black line ${n(line, 0)} m long.`],
      ['06 — The line', 'The camera rides the black line through the serpentine, past the plinths and up the glass.'],
      ['07 — The long lobe', ({ run }) => `${n(run, 1)} m along the balcony windows, then back beside the ${n(9.6, 1)} m table.`],
      ['08 — The pergola terrace', ({ covered }) => `${n(covered, 1)} m² under a white steel pergola, between the hall and the open terrace.`],
      ['09 — The terrace', ({ terrace }) => `${n(terrace, 1)} m² open to the sky. The paper sky gives way to the real one.`],
      ['10 — Back to the sheet', 'Cut at 1.20 m again: the drawing and the building, one model.'],
    ],
    rooms: {
      hall: 'HALL', big: 'BIG ROOM', dressing: 'DRESSING', bath: 'BATH', closet: '', core: 'STAIRS · LIFT',
      storeN: 'STORE', wc: 'WC', storeS: 'STORE', kitchen: 'KITCHEN', terrace: 'TERRACE', covered: 'PERGOLA\nTERRACE',
    },
    // Hussein Madi at Platform, 1988-89 (shown only with ?archive)
    capsArchive: {
      5: ['06 — The line', 'The line becomes a timeline: Madi’s four shows at Platform, in the order they opened.'],
      6: ['07 — The long lobe', 'Along the windows to the drawings, then back beside the table to the paintings.'],
    },
    timeline: {
      title: 'Platform, 1988–89',
      dates: { sculptures: '30 Nov 1988', pastels: '14 Dec 1988', dessins: '25 Jan 1989', peintures: '15 Feb 1989' },
      caps: {
        sculptures: ['Platform, 1988–89 · 1/4', 'Sculptures, opening 30 November 1988. The first of Hussein Madi’s four shows here.'],
        pastels: ['Platform, 1988–89 · 2/4', 'Pastels and watercolours, opening 14 December 1988.'],
        dessins: ['Platform, 1988–89 · 3/4', 'Drawings and prints, opening 25 January 1989.'],
        peintures: ['Platform, 1988–89 · 4/4', 'Paintings, opening 15 February 1989. The last of the four, all with Banque Libano-Française.'],
      },
    },
    shows: {
      peintures: ['Paintings', '15 February 1989'],
      pastels: ['Pastels and watercolours', '14 December 1988'],
      dessins: ['Drawings and prints', '25 January 1989'],
      sculptures: ['Sculptures', '30 November 1988'],
    },
    showLines: (title, date) => ['Hussein Madi', title, `Platform, opening ${date}`, 'with Banque Libano-Française'],
    posterNote: 'Exhibition poster',
    photos: {
      title: 'Platform 593 — photographs',
      description: 'Platform 593, Achrafieh, Beirut: the 2026 photographs placed on the plan, each one compared with the model from the same spot.',
      heading: 'Photographs, 2026',
      hint: 'Choose a camera on the plan to compare the photograph with the model from the same spot.',
      walk: 'The walk',
      photo: 'Photograph, 2026',
      model: 'Model',
      drawing: 'Drawing',
      approx: 'Position approximate: the 2026 fittings hide most of the walls the model has.',
      replanned: 'The hall was re-planned after the 2024 model: the glass meeting room and the shelving are not in it.',
      close: 'Back to the plan',
      prev: 'Previous photograph',
      next: 'Next photograph',
      slider: 'Slide between the photograph and the model',
      n: (i, total) => `${i} of ${total}`,
      copy: 'Copy positions',
      copied: 'Copied',
      placeHelp: 'Place mode: arrows move · Q/E turn · R/F tilt · T/G shift · [ ] roll · Z/X lens · PgUp/PgDn height · Shift for bigger steps',
      rooms: { hall: 'Hall', big: 'Big room', dressing: 'Dressing room', bath: 'Shower room', kitchen: 'Kitchen', covered: 'Pergola terrace' },
    },
    walkLink: 'Photographs',
    walk2Link: 'Walk 2',
    walk1Link: 'Walk 1',
    walk2: {
      title: 'Platform 593 — the second walk: the big room, the kitchen, the corridor',
      description: 'Platform 593, Achrafieh, Beirut. A second walk through the model: from the plan into the big room, through the hall to the kitchen, along the corridor and out onto the pergola terrace.',
      canvas: 'Platform 593: from the floor plan into the big room, the kitchen and the corridor to the pergola terrace, then back to the plan',
      markSub: 'Achrafieh, Beirut · the second walk',
      caps: [
        ['01 — The sheet', 'The same floor, cut at 1.20 m. This time the walk starts in the big room.'],
        ['02 — The big room', ({ big }) => `${n(big, 1)} m², glazed doors onto the balcony along the north façade.`],
        ['03 — Through the hall', 'Along the north windows, round the end of the long wall, past the front door.'],
        ['04 — The kitchen', ({ kitchen, win }) => `${n(kitchen, 1)} m²: a U of aubergine units under a window ${n(win, 2)} m wide, and a long table.`],
        ['05 — The corridor', ({ corridor }) => `${n(corridor, 1)} m from the kitchen door to the terrace, glass shelves in wooden frames along one side.`],
        ['06 — The pergola terrace', ({ covered }) => `Through the glazed door: ${n(covered, 1)} m² under the white steel pergola.`],
        ['07 — Back to the sheet', 'One model, two walks.'],
      ],
    },
    sheet: {
      place: 'Achrafieh, Beirut — first floor',
      cut: 'Plan cut at +1.20 m',
      source: 'Drawn from the Live Home 3D model',
      no: 'SHEET 01 · 1:100',
    },
  },
  fr: {
    title: 'Platform 593',
    description: 'Platform 593, Achrafieh, Beyrouth. Une promenade qui part du plan, traverse l’appartement et sa terrasse au coucher du soleil, puis revient au plan.',
    canvas: 'Platform 593 : du plan, à travers l’appartement jusqu’à la terrasse, puis retour au plan',
    markSub: 'Achrafieh, Beyrouth · premier étage',
    hint: 'Faites défiler pour avancer',
    hintHow: 'Molette de la souris, deux doigts sur le pavé tactile, ou les flèches du clavier',
    hintTouch: 'Glissez vers le haut pour avancer',
    hintTouchHow: 'Faites glisser un doigt vers le haut de l’écran',
    loader: 'Le plan se dessine',
    langLabel: 'Langue',
    fallback: 'Cette promenade a besoin de WebGL, que ce navigateur ne propose pas. Voici le plan.',
    caps: [
      ['01 — La planche', 'Le premier étage, coupé à 1,20 m. Chaque trait ici est la maquette.'],
      ['02 — Les murs s’élèvent', 'La coupe monte de 1,20 m jusqu’au plafond, à 2,80 m.'],
      ['03 — Le palier', 'Escalier et ascenseur. La porte d’entrée mesure 1,00 m de large.'],
      ['04 — La porte', 'Elle s’ouvre vers l’intérieur, et le dessin cède la place.'],
      ['05 — Le hall', ({ hall, line }) => `${n(hall, 1, 'fr')} m² de marbre blanc, et une seule ligne noire de ${n(line, 0, 'fr')} m.`],
      ['06 — La ligne', 'La caméra suit la ligne noire à travers le serpentin, le long des socles, puis au fil de la baie vitrée.'],
      ['07 — La grande boucle', ({ run }) => `${n(run, 1, 'fr')} m le long des fenêtres du balcon, puis retour le long de la table de ${n(9.6, 1, 'fr')} m.`],
      ['08 — La terrasse sous pergola', ({ covered }) => `${n(covered, 1, 'fr')} m² sous une pergola en acier blanc, entre le hall et la terrasse ouverte.`],
      ['09 — La terrasse', ({ terrace }) => `${n(terrace, 1, 'fr')} m² à ciel ouvert. Le ciel de papier laisse place au vrai.`],
      ['10 — Retour à la planche', 'De nouveau coupé à 1,20 m : le dessin et le bâtiment, une seule maquette.'],
    ],
    rooms: {
      hall: 'HALL', big: 'GRANDE\nPIÈCE', dressing: 'DRESSING', bath: 'BAINS', closet: '', core: 'ESCALIER\nASCENSEUR',
      storeN: 'RÉSERVE', wc: 'WC', storeS: 'RÉSERVE', kitchen: 'CUISINE', terrace: 'TERRASSE', covered: 'PERGOLA',
    },
    capsArchive: {
      5: ['06 — La ligne', 'La ligne devient une chronologie : les quatre expositions de Madi à Platform, dans l’ordre de leurs vernissages.'],
      6: ['07 — La grande boucle', 'Le long des fenêtres jusqu’aux dessins, puis retour le long de la table jusqu’aux peintures.'],
    },
    timeline: {
      title: 'Platform, 1988-1989',
      dates: { sculptures: '30 nov. 1988', pastels: '14 déc. 1988', dessins: '25 janv. 1989', peintures: '15 févr. 1989' },
      caps: {
        sculptures: ['Platform, 1988-1989 · 1/4', 'Sculptures, vernissage le 30 novembre 1988. La première des quatre expositions de Hussein Madi ici.'],
        pastels: ['Platform, 1988-1989 · 2/4', 'Pastels et aquarelles, vernissage le 14 décembre 1988.'],
        dessins: ['Platform, 1988-1989 · 3/4', 'Dessins et gravures, vernissage le 25 janvier 1989.'],
        peintures: ['Platform, 1988-1989 · 4/4', 'Peintures, vernissage le 15 février 1989. La dernière des quatre, toutes avec la Banque Libano-Française.'],
      },
    },
    shows: {
      peintures: ['Peintures', '15 février 1989'],
      pastels: ['Pastels et aquarelles', '14 décembre 1988'],
      dessins: ['Dessins et gravures', '25 janvier 1989'],
      sculptures: ['Sculptures', '30 novembre 1988'],
    },
    showLines: (title, date) => ['Hussein Madi', title, `Platform, vernissage le ${date}`, 'avec la Banque Libano-Française'],
    posterNote: 'Affiche de l’exposition',
    photos: {
      title: 'Platform 593 — photographies',
      description: 'Platform 593, Achrafieh, Beyrouth : les photographies de 2026 placées sur le plan, chacune comparée à la maquette depuis le même endroit.',
      heading: 'Photographies, 2026',
      hint: 'Choisissez un appareil sur le plan pour comparer la photographie à la maquette depuis le même endroit.',
      walk: 'La promenade',
      photo: 'Photographie, 2026',
      model: 'Maquette',
      drawing: 'Dessin',
      approx: 'Position approximative : les aménagements de 2026 cachent la plupart des murs de la maquette.',
      replanned: 'Le hall a été réaménagé après la maquette de 2024 : la salle de réunion vitrée et les étagères n’y figurent pas.',
      close: 'Retour au plan',
      prev: 'Photographie précédente',
      next: 'Photographie suivante',
      slider: 'Glisser entre la photographie et la maquette',
      n: (i, total) => `${i} sur ${total}`,
      copy: 'Copier les positions',
      copied: 'Copié',
      placeHelp: 'Mode placement : flèches pour déplacer · Q/E tourner · R/F incliner · T/G décentrer · [ ] pivoter · Z/X focale · PgUp/PgDn hauteur · Maj pour de plus grands pas',
      rooms: { hall: 'Hall', big: 'Grande pièce', dressing: 'Dressing', bath: 'Salle d’eau', kitchen: 'Cuisine', covered: 'Terrasse sous pergola' },
    },
    walkLink: 'Photographies',
    walk2Link: 'Promenade 2',
    walk1Link: 'Promenade 1',
    walk2: {
      title: 'Platform 593 — la seconde promenade : la grande pièce, la cuisine, le couloir',
      description: 'Platform 593, Achrafieh, Beyrouth. Une seconde promenade dans la maquette : du plan à la grande pièce, à travers le hall jusqu’à la cuisine, le long du couloir et sur la terrasse sous pergola.',
      canvas: 'Platform 593 : du plan à la grande pièce, la cuisine et le couloir jusqu’à la terrasse sous pergola, puis retour au plan',
      markSub: 'Achrafieh, Beyrouth · la seconde promenade',
      caps: [
        ['01 — La planche', 'Le même étage, coupé à 1,20 m. Cette fois, la promenade commence dans la grande pièce.'],
        ['02 — La grande pièce', ({ big }) => `${n(big, 1, 'fr')} m², des portes vitrées sur le balcon de la façade nord.`],
        ['03 — À travers le hall', 'Le long des fenêtres nord, autour du grand mur, devant la porte d’entrée.'],
        ['04 — La cuisine', ({ kitchen, win }) => `${n(kitchen, 1, 'fr')} m² : un U de meubles aubergine sous une fenêtre de ${n(win, 2, 'fr')} m, et une longue table.`],
        ['05 — Le couloir', ({ corridor }) => `${n(corridor, 1, 'fr')} m de la porte de la cuisine à la terrasse, des étagères de verre dans des cadres de bois sur un côté.`],
        ['06 — La terrasse sous pergola', ({ covered }) => `Par la porte vitrée : ${n(covered, 1, 'fr')} m² sous la pergola en acier blanc.`],
        ['07 — Retour à la planche', 'Une maquette, deux promenades.'],
      ],
    },
    sheet: {
      place: 'Achrafieh, Beyrouth — premier étage',
      cut: 'Plan coupé à +1,20 m',
      source: 'D’après la maquette Live Home 3D',
      no: 'PLANCHE 01 · 1:100',
    },
  },
};

// number in the language's own decimal style
export function n(v, digits, lang = 'en') {
  const s = Number(v).toFixed(digits);
  return lang === 'fr' ? s.replace('.', ',') : s;
}

export function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'fr') return q;
  try {
    const saved = localStorage.getItem('p593-lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch (e) { /* storage blocked */ }
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function rememberLang(lang) {
  try { localStorage.setItem('p593-lang', lang); } catch (e) { /* storage blocked */ }
  const u = new URL(location.href);
  u.searchParams.set('lang', lang);
  history.replaceState(null, '', u);
}
