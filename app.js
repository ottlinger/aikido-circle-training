(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  let simulation;
  let running = false;
  let timer = null;
  let nodes = [];

  function randomCount() {
    // Uniform random integer, including both ends; no server or personal data.
    const value = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / 18) * 18;
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return 3 + value[0] % 18;
  }

  function svgElement(name, attributes, text) {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function updateStarters() {
    const oldValue = Number($('starter').value);
    $('starter').replaceChildren();
    for (let id = 0; id < Number($('count').value); id++) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `Aikidōka ${id + 1}`;
      $('starter').append(option);
    }
    $('starter').value = oldValue < Number($('count').value) ? oldValue : 0;
    $('count-value').textContent = $('count').value;
  }

  function buildCircle() {
    $('participants').replaceChildren();
    $('home-positions').replaceChildren();
    nodes = [];
    const layout = circleLayout(simulation);
    for (const person of simulation.people) {
      const { x, y, radius } = layout.homes[person.id];
      const home = svgElement('g', { class: 'home-position', transform: `translate(${x} ${y})`, 'aria-hidden': 'true' });
      home.append(svgElement('circle', { r: radius }), svgElement('text', { x: 0, y: 0 }, person.id + 1));
      $('home-positions').append(home);
      const group = svgElement('g', { class: 'person' });
      const position = layout.people[person.id];
      group.style.transform = `translate(${position.x}px, ${position.y}px)`;
      const title = svgElement('title', {}, '');
      const badge = svgElement('text', { x: 0, y: -radius - 9, class: 'role-badge' }, '');
      const counter = svgElement('text', { x: 0, y: 11, class: 'throw-counter' }, '');
      const number = svgElement('text', { x: 0, y: 0 }, person.id + 1);
      group.append(title, svgElement('circle', { r: radius }), number, badge, counter);
      $('participants').append(group);
      nodes.push({ group, title, badge, counter, number });
    }
    $('center-count').textContent = `${simulation.count} Teilnehmer · ${simulation.repetitions} Würfe`;
    $('center-direction').textContent = simulation.direction === 1 ? '↻ Im Uhrzeigersinn' : '↺ Gegen den Uhrzeigersinn';
    $('direction-guide').setAttribute('d', simulation.direction === 1 ? 'M 320 73 A 247 247 0 0 1 567 320' : 'M 320 73 A 247 247 0 0 0 73 320');
    $('legend-nage').textContent = simulation.mode === 'nage' ? 'Nage · innen' : 'Nage · am Kreisplatz';
    $('legend-uke').textContent = simulation.mode === 'nage' ? 'Uke · am Kreisplatz' : 'Uke · innen';
    $('svg-description').textContent = simulation.mode === 'nage'
      ? 'Nage wandert innen und wirft Uke am festen Kreisplatz. N kennzeichnet Nage, U kennzeichnet Uke.'
      : 'Uke wandert innen, greift Nage am festen Kreisplatz an und wird von ihm geworfen. U kennzeichnet Uke, N kennzeichnet Nage.';
    $('svg-description').textContent += ' Jedes Zweierpaar hat eine gemeinsame Farbe. Der Zähler zeigt ausgeführte und gesamte Wiederholungen. Nach der Runde kehrt der Teilnehmer zum Startplatz zurück.';
  }

  function render() {
    $('status').textContent = running ? 'In Bewegung' : simulation.totalThrows ? 'Pausiert' : 'Bereit';
    $('play').textContent = running ? 'Ⅱ Pausieren' : simulation.totalThrows ? '▶ Fortsetzen' : '▶ Starten';
    $('step').disabled = running;
    $('throws-stat').textContent = simulation.totalThrows;
    $('pairs-stat').textContent = simulation.completedPairs;
    $('cycles-stat').textContent = Math.min(...simulation.people.map((person) => person.completedCycles));
    const layout = circleLayout(simulation);
    const attacking = simulation.mode === 'uke';
    const unit = attacking ? 'Angriffe' : 'Würfe';
    const passedAction = attacking ? 'haben angegriffen' : 'haben geworfen';
    const nextRole = attacking ? 'Angreifer' : 'Werfer';
    const starter = simulation.people[simulation.starter];
    const starterProgress = simulation.roundProgress(starter);
    $('starter-progress').textContent = `Startpartner ${starter.id + 1} (${attacking ? 'Uke' : 'Nage'}): ${starterProgress.done} / ${starterProgress.total} ${unit} · noch ${starterProgress.remaining}`;
    $('starter-state').textContent = starter.phase === 'ready'
      ? `Eigene Runde ${starter.completedCycles + 1} läuft · nächster Partner: ${simulation.target(starter) + 1}.`
      : `Eigene Runde beendet · wieder am Startplatz · nächster ${nextRole}: Partner ${simulation.incomingMover(starter) + 1}.`;
    document.documentElement.style.setProperty('--move-duration', `${Math.min(450, 600 / Number($('speed').value))}ms`);
    $('connections').replaceChildren();
    $('current-pairs').replaceChildren();
    if (!layout.pairs.length) $('current-pairs').textContent = 'Rückkehr an die Startplätze – danach geht es weiter.';
    for (const pair of layout.pairs) {
      const from = layout.people[pair.mover];
      const to = layout.people[pair.partner];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const startX = from.x + dx / distance * (from.radius + 5);
      const startY = from.y + dy / distance * (from.radius + 5);
      const endX = to.x - dx / distance * (to.radius + 9);
      const endY = to.y - dy / distance * (to.radius + 9);
      const markerId = `pair-arrow-${pair.mover}`;
      const marker = svgElement('marker', { id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto' });
      marker.append(svgElement('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: pair.color }));
      const defs = svgElement('defs', {});
      defs.append(marker);
      const connection = svgElement('path', {
        class: 'connection',
        d: `M ${startX} ${startY} L ${endX} ${endY}`,
        'marker-end': `url(#${markerId})`,
      });
      connection.style.setProperty('--pair-color', pair.color);
      $('connections').append(defs, connection);
      const entry = document.createElement('div');
      entry.className = 'pair';
      entry.style.setProperty('--pair-color', pair.color);
      const fromLabel = document.createElement('span');
      fromLabel.className = 'from';
      fromLabel.textContent = `${attacking ? 'Uke' : 'Nage'} ${pair.mover + 1}`;
      const toLabel = document.createElement('span');
      toLabel.className = 'to';
      toLabel.textContent = `${attacking ? 'Nage' : 'Uke'} ${pair.partner + 1}`;
      const detail = document.createElement('small');
      detail.textContent = attacking
        ? `Angriff + Wurf: ${pair.throws} / ${simulation.repetitions}`
        : `Dieser Partner: ${pair.throws} / ${simulation.repetitions} Würfe`;
      const round = document.createElement('strong');
      round.className = 'round-counter';
      const counts = simulation.roundProgress(simulation.people[pair.mover]);
      round.textContent = `Runde: ${counts.done}/${counts.total} · noch ${counts.remaining} ${unit}`;
      entry.append(fromLabel, attacking ? ' greift an → ' : ' wirft → ', toLabel, detail, round);
      $('current-pairs').append(entry);
    }
    $('progress-list').replaceChildren();
    const labels = {
      nage: attacking ? 'wirft am Kreisplatz' : 'wirft im Kreisinneren',
      uke: attacking ? 'greift innen an und wird geworfen' : 'wird am Kreisplatz geworfen',
      ready: 'wartet innen auf nächsten Partner', idle: 'wartet auf den Einstieg',
      returning: 'kehrt zum Startplatz zurück', waiting: 'wartet am Startplatz',
    };
    for (const person of simulation.people) {
      const position = layout.people[person.id];
      const currentRole = position.role;
      nodes[person.id].group.setAttribute('class', `person ${currentRole}${position.moving ? ' moving' : ''}${position.color ? ' paired' : ''}`);
      nodes[person.id].group.style.transform = `translate(${position.x}px, ${position.y}px)`;
      if (position.color) nodes[person.id].group.style.setProperty('--pair-color', position.color);
      else nodes[person.id].group.style.removeProperty('--pair-color');
      const counts = simulation.roundProgress(person);
      const badgeRole = person.phase === 'ready' ? simulation.mode : currentRole;
      nodes[person.id].badge.textContent = badgeRole === 'nage' ? 'N' : badgeRole === 'uke' ? 'U' : '';
      nodes[person.id].counter.textContent = person.phase === 'ready' ? `${counts.done}/${counts.total}` : '';
      nodes[person.id].number.setAttribute('y', person.phase === 'ready' ? -6 : 0);
      nodes[person.id].title.textContent = `Partner ${person.id + 1}: ${labels[currentRole]}. Eigene Runde: ${counts.done} von ${counts.total} ${unit}, noch ${counts.remaining}. ${person.completedCycles} Runden beendet.`;
      const row = document.createElement('div');
      row.className = 'progress-row';
      const number = document.createElement('span');
      number.className = 'progress-number';
      number.textContent = person.id + 1;
      const detail = document.createElement('div');
      detail.className = 'progress-detail';
      const received = person.received.filter((amount, id) => id !== person.id && amount >= Math.max(1, person.completedCycles)).length;
      detail.textContent = person.phase === 'waiting' || person.phase === 'returning'
        ? `${labels[currentRole]} · ${received}/${simulation.count - 1} ${passedAction} · als Nächstes: ${simulation.incomingMover(person) + 1}`
        : person.phase === 'idle' ? `Wartet, bis der direkte Vorgänger mit ihm geübt hat. ${labels[currentRole]}.`
        : `Runde ${person.completedCycles + 1} · ${labels[currentRole]}`;
      const counter = document.createElement('strong');
      counter.className = 'round-counter';
      counter.textContent = `${counts.done}/${counts.total} ${unit} · noch ${counts.remaining}`;
      detail.append(counter);
      const progress = document.createElement('progress');
      progress.max = counts.total;
      progress.value = counts.done;
      progress.setAttribute('aria-label', `Partner ${person.id + 1}: ausgeführte ${unit} der eigenen Runde`);
      detail.append(progress);
      row.append(number, detail);
      $('progress-list').append(row);
    }
  }

  function queueTick() {
    clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(() => {
      simulation.advance();
      render();
      queueTick();
    }, 900 / Number($('speed').value));
  }

  function pause() {
    running = false;
    clearTimeout(timer);
    document.body.classList.remove('running');
  }

  function reset() {
    pause();
    simulation = new CircleTraining({
      count: Number($('count').value),
      repetitions: Number($('repetitions').value),
      direction: Number($('direction').value),
      starter: Number($('starter').value),
      mode: $('mode').value,
    });
    buildCircle();
    render();
  }

  $('play').addEventListener('click', () => {
    if (running) pause();
    else {
      running = true;
      document.body.classList.add('running');
      queueTick();
    }
    render();
  });
  $('step').addEventListener('click', () => { simulation.advance(); render(); });
  $('reset').addEventListener('click', reset);
  $('randomize').addEventListener('click', () => {
    $('count').value = randomCount();
    updateStarters();
    reset();
  });
  $('count').addEventListener('input', () => { updateStarters(); reset(); });
  for (const id of ['direction', 'repetitions', 'starter', 'mode']) $(id).addEventListener('change', reset);
  $('speed').addEventListener('input', () => { $('speed-value').textContent = `${$('speed').value}×`; queueTick(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { pause(); render(); }
  });
  $('count').value = randomCount();
  updateStarters();
  reset();
})();
