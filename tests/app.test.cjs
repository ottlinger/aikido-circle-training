const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CircleTraining } = require('../simulation.js');
const { circleLayout } = require('../visualization.js');
const KeikoI18n = require('../i18n.js');

// Minimal DOM and controllable timers: exercise the actual browser controller without dependencies.
function createApp() {
  class Element {
    constructor() {
      this.value = '';
      this.textContent = '';
      this.children = [];
      this.disabled = false;
      this.listeners = {};
      this.style = { setProperty() {}, removeProperty() {} };
    }
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
    addEventListener(event, listener) { this.listeners[event] = listener; }
    dispatch(event) { this.listeners[event](); }
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  for (const id of ['count', 'speed']) {
    elements[id].value = html.match(new RegExp(`id="${id}"[^>]*value="([^"]+)"`))[1];
  }
  for (const id of ['direction', 'mode', 'repetitions', 'rounds', 'language']) {
    const options = html.match(new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`))[1];
    const selected = options.match(/<option value="([^"]+)"[^>]*\bselected\b/);
    elements[id].value = (selected || options.match(/<option value="([^"]+)"/))[1];
  }
  const classes = new Set();
  const document = {
    getElementById: (id) => elements[id],
    createElement: () => new Element(),
    createElementNS: () => new Element(),
    querySelectorAll: () => [],
    documentElement: new Element(),
    body: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } },
    addEventListener() {},
  };
  let timerId = 0;
  const timers = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, CircleTraining, circleLayout, KeikoI18n,
    crypto: { getRandomValues: (values) => { values[0] = 0; } },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    elements, classes, timers,
    tick() {
      assert.equal(timers.size, 1);
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
    },
  };
}

test('browser defaults to three rounds; manual steps finish and restart resets counters', () => {
  const { elements, timers } = createApp();
  assert.equal(elements.rounds.value, '3');
  assert.equal(elements['cycles-stat'].textContent, '1 / 3');
  const roundsSeen = new Set([elements['cycles-stat'].textContent]);
  for (let step = 0; step < 100 && !elements.step.disabled; step++) {
    elements.step.dispatch('click');
    roundsSeen.add(elements['cycles-stat'].textContent);
  }
  assert.deepEqual([...roundsSeen], ['1 / 3', '2 / 3', '3 / 3']);
  assert.equal(elements.status.textContent, 'Training beendet');
  assert.equal(elements['cycles-stat'].textContent, '3 / 3');
  assert.equal(elements['throws-stat'].textContent, '36');
  assert.equal(elements.play.textContent, '↻ Neu starten');
  assert.equal(elements.step.disabled, true);
  assert.equal(timers.size, 0);
  assert.equal(elements['current-pairs'].textContent, KeikoI18n.createTranslator().t('trainingFinished'));
  elements.play.dispatch('click');
  assert.equal(elements['throws-stat'].textContent, '0');
  assert.equal(elements['cycles-stat'].textContent, '1 / 3');
  assert.equal(elements.status.textContent, 'In Bewegung');
  assert.equal(timers.size, 1);
});

test('automatic finite training cancels its timer and can be translated after completion', () => {
  const app = createApp();
  const { elements, timers, classes } = app;
  elements.rounds.value = '2';
  elements.rounds.dispatch('change');
  elements.play.dispatch('click');
  for (let step = 0; step < 200 && timers.size; step++) app.tick();
  assert.equal(timers.size, 0);
  assert.equal(classes.has('running'), false);
  assert.equal(elements.status.textContent, 'Training beendet');
  assert.equal(elements['cycles-stat'].textContent, '2 / 2');
  assert.equal(elements['throws-stat'].textContent, '24');
  elements.language.value = 'en';
  elements.language.dispatch('change');
  assert.equal(elements.status.textContent, 'Training complete');
  assert.equal(elements.play.textContent, '↻ Restart');
  assert.equal(elements['throws-stat'].textContent, '24');
});

test('unlimited training keeps running; changing rounds cancels and resets the session', () => {
  const app = createApp();
  const { elements, timers, classes } = app;
  elements.rounds.value = 'Infinity';
  elements.rounds.dispatch('change');
  assert.equal(elements['cycles-stat'].textContent, '1 / ∞');
  elements.play.dispatch('click');
  for (let step = 0; step < 200; step++) app.tick();
  assert.equal(timers.size, 1);
  assert.equal(classes.has('running'), true);
  assert.match(elements['cycles-stat'].textContent, / \/ ∞$/);
  assert.ok(Number(elements['throws-stat'].textContent) > 12);
  elements.rounds.value = '1';
  elements.rounds.dispatch('change');
  assert.equal(timers.size, 0);
  assert.equal(classes.has('running'), false);
  assert.equal(elements['throws-stat'].textContent, '0');
  assert.equal(elements['cycles-stat'].textContent, '1 / 1');
  assert.equal(elements.step.disabled, false);
});
