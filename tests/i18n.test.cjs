const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { translations, createTranslator } = require('../i18n.js');

const placeholders = (message) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('German is the default, regardless of browser language; unsupported languages fall back to German', () => {
  assert.equal(createTranslator().language, 'de');
  assert.equal(createTranslator('en').language, 'en');
  for (const language of ['fr', '', 'toString', '__proto__', null]) {
    assert.equal(createTranslator(language).language, 'de');
  }
  assert.equal(createTranslator().t('participants'), 'Teilnehmer');
  assert.equal(createTranslator('en').t('participants'), 'Participants');
});

test('both languages provide every message with exactly the same placeholders', () => {
  assert.deepEqual(Object.keys(translations.de).sort(), Object.keys(translations.en).sort());
  for (const key of Object.keys(translations.de)) {
    assert.ok(translations.de[key].trim(), `empty German message: ${key}`);
    assert.ok(translations.en[key].trim(), `empty English message: ${key}`);
    assert.deepEqual(placeholders(translations.de[key]), placeholders(translations.en[key]), key);
    for (const language of ['de', 'en']) {
      const parameters = Object.fromEntries(placeholders(translations[language][key]).map((name) => [name, 4]));
      const result = createTranslator(language).t(key, parameters);
      assert.equal(/\{\w+\}/.test(result), false, `unresolved parameter in ${language}.${key}`);
    }
  }
});

test('all static translation markers in index.html have both translations', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length > 40, 'headings, settings, legend, rules and footer are translated');
  for (const key of keys) {
    assert.doesNotThrow(() => createTranslator('de').t(key));
    assert.doesNotThrow(() => createTranslator('en').t(key));
  }
  assert.match(html, /<html lang="de">/);
  assert.match(html, /<option value="de" lang="de" selected>Deutsch<\/option>/);
  assert.match(html, /<option value="en" lang="en">English<\/option>/);
  assert.match(html, /href="https:\/\/github\.com\/ottlinger\/aikido-circle-training"/);
  assert.match(html, /data-i18n-aria-label="githubLinkLabel"><svg/);
});

test('dynamic progress, roles and accessibility text are translated in both training modes', () => {
  const de = createTranslator();
  const en = createTranslator('en');
  const progress = { id: 1, role: 'Uke', done: 8, total: 14, remaining: 6 };
  assert.equal(de.t('starterProgress', { ...progress, unit: de.t('unitAttacks') }), 'Startpartner 1 (Uke): 8 / 14 Angriffe · noch 6');
  assert.equal(en.t('starterProgress', { ...progress, unit: en.t('unitAttacks') }), 'Starting partner 1 (Uke): 8 / 14 attacks · 6 left');
  assert.equal(en.t('pairThrows', { done: 1, total: 2 }), 'This partner: 1 / 2 throws');
  assert.equal(en.t('pairAttacks', { done: 1, total: 4 }), 'Attack + throw: 1 / 4');
  assert.equal(en.t('legendNageHome'), 'Nage · at circle position');
  assert.equal(en.t('legendUkeInner'), 'Uke · inside');
  assert.match(en.t('svgDescriptionUke'), /attacks Nage/);
  assert.equal(en.t('progressAria', { id: 2, unit: en.t('unitThrows') }), 'Partner 2: completed throws in their own round');
  assert.equal(en.t('starterWaiting', { role: en.t('nextAttacker'), partner: 2 }), 'Own round complete · back at home position · next attacker: Partner 2.');
  assert.equal(de.t('githubLinkLabel'), 'Quellcode auf GitHub');
  assert.equal(en.t('githubLinkLabel'), 'Source code on GitHub');
});

test('numeric formatting follows the selected language', () => {
  assert.equal(createTranslator('de').number(0.5), '0,5');
  assert.equal(createTranslator('en').number(0.5), '0.5');
  assert.equal(createTranslator('de').number(1234), '1.234');
  assert.equal(createTranslator('en').number(1234), '1,234');
});

test('missing keys and parameters fail explicitly instead of displaying untranslated placeholders', () => {
  const translator = createTranslator();
  assert.throws(() => translator.t('missing'), /Unknown translation key/);
  assert.throws(() => translator.t('toString'), /Unknown translation key/);
  assert.throws(() => translator.t('starterProgress'), /Missing translation parameter/);
});
