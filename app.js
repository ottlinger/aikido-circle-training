(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const svgNS = 'http://www.w3.org/2000/svg';
  let simulation;
  let running = false;
  let timer = null;
  let nodes = [];
  let translator = KeikoI18n.createTranslator();
  const t = (key, parameters) => translator.t(key, parameters);

  function applyTranslations() {
    document.documentElement.lang = translator.language;
    $('language').value = translator.language;
    document.title = t('pageTitle');
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = t(element.dataset.i18n);
    }
    for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
      element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    }
    $('speed-value').textContent = `${translator.number(Number($('speed').value))}×`;
  }

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
  }

  function updateCircleText() {
    $('center-count').textContent = t('centerCount', { count: simulation.count, repetitions: simulation.repetitions });
    $('center-direction').textContent = t(simulation.direction === 1 ? 'clockwise' : 'counterclockwise');
    $('direction-guide').setAttribute('d', simulation.direction === 1 ? 'M 320 73 A 247 247 0 0 1 567 320' : 'M 320 73 A 247 247 0 0 0 73 320');
    $('legend-nage').textContent = t(simulation.mode === 'nage' ? 'legendNageInner' : 'legendNageHome');
    $('legend-uke').textContent = t(simulation.mode === 'nage' ? 'legendUkeHome' : 'legendUkeInner');
    $('svg-description').textContent = `${t(simulation.mode === 'nage' ? 'svgDescriptionNage' : 'svgDescriptionUke')} ${t('svgDescriptionShared')}`;
  }

  function render() {
    updateCircleText();
    $('status').textContent = t(simulation.finished ? 'statusFinished' : running ? 'statusRunning' : simulation.totalThrows ? 'statusPaused' : 'statusReady');
    $('play').textContent = t(simulation.finished ? 'playRestart' : running ? 'playPause' : simulation.totalThrows ? 'playResume' : 'playStart');
    $('step').disabled = running || simulation.finished;
    $('throws-stat').textContent = translator.number(simulation.totalThrows);
    $('pairs-stat').textContent = translator.number(simulation.completedPairs);
    const currentRound = Math.min(simulation.rounds, Math.min(...simulation.people.map((person) => person.completedCycles)) + 1);
    $('cycles-stat').textContent = `${translator.number(currentRound)} / ${simulation.rounds === Infinity ? '∞' : translator.number(simulation.rounds)}`;
    const layout = circleLayout(simulation);
    const attacking = simulation.mode === 'uke';
    const unit = t(attacking ? 'unitAttacks' : 'unitThrows');
    const passedAction = t(attacking ? 'passedAttack' : 'passedThrow');
    const nextRole = t(attacking ? 'nextAttacker' : 'nextThrower');
    const starter = simulation.people[simulation.starter];
    const starterProgress = simulation.roundProgress(starter);
    $('starter-progress').textContent = t('starterProgress', {
      id: starter.id + 1, role: attacking ? 'Uke' : 'Nage', unit, ...starterProgress,
    });
    $('starter-state').textContent = simulation.finished ? t('trainingFinished')
      : starter.completedCycles >= simulation.rounds ? t('starterRoundsComplete')
      : starter.phase === 'ready'
        ? t('starterMoving', { cycle: starter.completedCycles + 1, partner: simulation.target(starter) + 1 })
        : t('starterWaiting', { role: nextRole, partner: simulation.incomingMover(starter) + 1 });
    document.documentElement.style.setProperty('--move-duration', `${Math.min(450, 600 / Number($('speed').value))}ms`);
    $('connections').replaceChildren();
    $('current-pairs').replaceChildren();
    if (!layout.pairs.length) $('current-pairs').textContent = t(simulation.finished ? 'trainingFinished' : 'pairsReturning');
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
      fromLabel.textContent = t('pairRole', { role: attacking ? 'Uke' : 'Nage', id: pair.mover + 1 });
      const toLabel = document.createElement('span');
      toLabel.className = 'to';
      toLabel.textContent = t('pairRole', { role: attacking ? 'Nage' : 'Uke', id: pair.partner + 1 });
      const detail = document.createElement('small');
      detail.textContent = t(attacking ? 'pairAttacks' : 'pairThrows', { done: pair.throws, total: simulation.repetitions });
      const round = document.createElement('strong');
      round.className = 'round-counter';
      const counts = simulation.roundProgress(simulation.people[pair.mover]);
      round.textContent = t('pairRound', { ...counts, unit });
      entry.append(fromLabel, t(attacking ? 'pairActionAttack' : 'pairActionThrow'), toLabel, detail, round);
      $('current-pairs').append(entry);
    }
    $('progress-list').replaceChildren();
    const labels = {
      nage: t(attacking ? 'roleNageHome' : 'roleNageInner'),
      uke: t(attacking ? 'roleUkeInner' : 'roleUkeHome'),
      ready: t('roleReady'), idle: t('roleIdle'),
      returning: t('roleReturning'), waiting: t('roleWaiting'),
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
      nodes[person.id].title.textContent = t('personTitle', {
        id: person.id + 1, state: labels[currentRole], ...counts, unit, cycles: person.completedCycles,
      });
      const row = document.createElement('div');
      row.className = 'progress-row';
      const number = document.createElement('span');
      number.className = 'progress-number';
      number.textContent = person.id + 1;
      const detail = document.createElement('div');
      detail.className = 'progress-detail';
      const received = person.received.filter((amount, id) => id !== person.id && amount >= Math.max(1, person.completedCycles)).length;
      detail.textContent = person.completedCycles >= simulation.rounds
        ? t('ownRoundsComplete', { cycles: person.completedCycles, state: labels[currentRole] })
        : person.phase === 'waiting' || person.phase === 'returning'
        ? t('personWaiting', { state: labels[currentRole], received, count: simulation.count - 1, action: passedAction, partner: simulation.incomingMover(person) + 1 })
        : person.phase === 'idle' ? t('personIdle', { state: labels[currentRole] })
        : t('personRound', { cycle: person.completedCycles + 1, state: labels[currentRole] });
      const counter = document.createElement('strong');
      counter.className = 'round-counter';
      counter.textContent = t('personCounter', { ...counts, unit });
      detail.append(counter);
      const progress = document.createElement('progress');
      progress.max = counts.total;
      progress.value = counts.done;
      progress.setAttribute('aria-label', t('progressAria', { id: person.id + 1, unit }));
      detail.append(progress);
      row.append(number, detail);
      $('progress-list').append(row);
    }
  }

  function queueTick() {
    clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(() => {
      advance();
      queueTick();
    }, 900 / Number($('speed').value));
  }

  function advance() {
    simulation.advance();
    if (simulation.finished) pause();
    render();
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
      rounds: Number($('rounds').value),
    });
    buildCircle();
    render();
  }

  $('play').addEventListener('click', () => {
    if (running) pause();
    else {
      if (simulation.finished) reset();
      running = true;
      document.body.classList.add('running');
      queueTick();
    }
    render();
  });
  $('step').addEventListener('click', advance);
  $('reset').addEventListener('click', reset);
  $('randomize').addEventListener('click', () => {
    $('count').value = randomCount();
    updateStarters();
    reset();
  });
  $('count').addEventListener('input', () => { updateStarters(); reset(); });
  for (const id of ['direction', 'repetitions', 'starter', 'mode', 'rounds']) $(id).addEventListener('change', reset);
  $('speed').addEventListener('input', () => { $('speed-value').textContent = `${translator.number(Number($('speed').value))}×`; queueTick(); });
  $('language').addEventListener('change', () => {
    translator = KeikoI18n.createTranslator($('language').value);
    applyTranslations();
    render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) { pause(); render(); }
  });
  applyTranslations();
  $('count').value = randomCount();
  updateStarters();
  reset();
})();
