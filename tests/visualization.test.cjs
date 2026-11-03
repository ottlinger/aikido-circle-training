const test = require('node:test');
const assert = require('node:assert/strict');
const { CircleTraining } = require('../simulation.js');
const { circleLayout } = require('../visualization.js');
const distanceFromCenter = (point) => Math.hypot(point.x - 320, point.y - 320);

for (const direction of [1, -1]) {
  test(`layout: stationary Uke, moving Tori, distinct pair colors and homecomings (direction ${direction})`, () => {
    for (let count = 3; count <= 20; count++) {
      const sim = new CircleTraining({ count, direction });
      const homes = circleLayout(sim).homes;
      for (let tick = 0; tick < 600; tick++) {
        const layout = circleLayout(sim);
        assert.deepEqual(layout.homes, homes, 'home positions never change');
        assert.equal(layout.people.length, count, 'one marker per participant');
        assert.equal(new Set(layout.pairs.map((pair) => pair.color)).size, layout.pairs.length, 'each active pair has a different color');
        for (const pair of layout.pairs) {
          const tori = layout.people[pair.tori];
          const uke = layout.people[pair.uke];
          assert.equal(tori.role, 'tori');
          assert.equal(uke.role, 'uke');
          assert.equal(tori.color, uke.color);
          assert.equal(tori.color, pair.color);
          assert.equal(uke.x, homes[pair.uke].x);
          assert.equal(uke.y, homes[pair.uke].y);
          assert.ok(Math.abs(distanceFromCenter(tori) - 185) < 1e-9);
          assert.ok(Math.abs(Math.hypot(tori.x - uke.x, tori.y - uke.y) - 62) < 1e-9, 'Tori stands just inside the current Uke');
        }
        for (const person of sim.people) {
          if (['waiting', 'returning', 'idle'].includes(person.phase)) {
            const marker = layout.people[person.id];
            assert.equal(marker.x, homes[person.id].x);
            assert.equal(marker.y, homes[person.id].y);
          }
        }
        sim.advance();
      }
    }
  });
}

test('starter begins inside by the first partner and moves to the next partner', () => {
  const sim = new CircleTraining({ count: 8 });
  const before = circleLayout(sim);
  assert.equal(before.people[0].role, 'tori');
  assert.notEqual(before.people[0].x, before.homes[0].x);
  sim.advance();
  sim.advance();
  for (let tick = 0; tick < 100 && !sim.pairs.some((pair) => pair.tori === 0); tick++) sim.advance();
  const after = circleLayout(sim);
  assert.equal(after.people[0].role, 'tori');
  assert.notEqual(after.people[0].x, before.people[0].x);
  assert.notEqual(after.people[0].y, before.people[0].y);
  assert.equal(after.pairs.find((pair) => pair.tori === 0).uke, 2);
});
