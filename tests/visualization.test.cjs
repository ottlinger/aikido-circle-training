const test = require('node:test');
const assert = require('node:assert/strict');
const { CircleTraining } = require('../simulation.js');
const { circleLayout } = require('../visualization.js');
const distanceFromCenter = (point) => Math.hypot(point.x - 320, point.y - 320);

for (const mode of ['nage', 'uke']) {
  for (const direction of [1, -1]) {
    test(`${mode}: stationary partner, moving traveler, unique pair colors and homecomings (direction ${direction})`, () => {
      for (let count = 3; count <= 20; count++) {
        const sim = new CircleTraining({ count, direction, mode });
        const homes = circleLayout(sim).homes;
        for (let tick = 0; tick < 600; tick++) {
          const layout = circleLayout(sim);
          assert.deepEqual(layout.homes, homes);
          assert.equal(layout.people.length, count, 'one marker per participant');
          assert.equal(new Set(layout.pairs.map((pair) => pair.color)).size, layout.pairs.length);
          for (const pair of layout.pairs) {
            const mover = layout.people[pair.mover];
            const partner = layout.people[pair.partner];
            const roles = sim.pairRoles(pair);
            assert.equal(layout.people[roles.nage].role, 'nage');
            assert.equal(layout.people[roles.uke].role, 'uke');
            assert.equal(mover.moving, true);
            assert.equal(partner.moving, false);
            assert.equal(mover.color, partner.color);
            assert.equal(mover.color, pair.color);
            assert.equal(partner.x, homes[pair.partner].x);
            assert.equal(partner.y, homes[pair.partner].y);
            assert.ok(Math.abs(distanceFromCenter(mover) - 185) < 1e-9);
            assert.ok(Math.abs(Math.hypot(mover.x - partner.x, mover.y - partner.y) - 62) < 1e-9);
          }
          for (const person of sim.people) {
            if (['waiting', 'returning', 'idle'].includes(person.phase)) {
              const marker = layout.people[person.id];
              assert.equal(marker.x, homes[person.id].x);
              assert.equal(marker.y, homes[person.id].y);
              assert.equal(marker.moving, false);
            }
          }
          sim.advance();
        }
      }
    });
  }

  test(`${mode}: starter begins inside and moves to the next partner without changing role`, () => {
    const sim = new CircleTraining({ count: 8, mode });
    const before = circleLayout(sim);
    assert.equal(before.people[0].role, mode);
    assert.notEqual(before.people[0].x, before.homes[0].x);
    sim.advance();
    sim.advance();
    const after = circleLayout(sim);
    assert.equal(after.people[0].role, mode);
    assert.notEqual(after.people[0].x, before.people[0].x);
    assert.notEqual(after.people[0].y, before.people[0].y);
    assert.equal(after.pairs.find((pair) => pair.mover === 0).partner, 2);
  });
}
