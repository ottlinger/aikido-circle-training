const test = require('node:test');
const assert = require('node:assert/strict');
const { CircleTraining } = require('../simulation.js');

function checkPairs(simulation) {
  const used = new Set();
  for (const pair of simulation.pairs) {
    assert.notEqual(pair.mover, pair.partner);
    assert.equal(used.has(pair.mover), false, 'traveler must not be in two pairs');
    assert.equal(used.has(pair.partner), false, 'stationary partner must not be in two pairs');
    used.add(pair.mover);
    used.add(pair.partner);
    assert.equal(pair.partner, simulation.target(simulation.people[pair.mover]));
    assert.notEqual(simulation.people[pair.partner].phase, 'ready', 'a traveler must not become a stationary partner mid-tour');
    assert.equal(pair.mover, simulation.incomingMover(simulation.people[pair.partner]), 'followers must not overtake');
    const roles = simulation.pairRoles(pair);
    assert.deepEqual(roles, simulation.mode === 'nage'
      ? { nage: pair.mover, uke: pair.partner }
      : { nage: pair.partner, uke: pair.mover });
  }
}

for (const mode of ['nage', 'uke']) {
  test(`${mode}: first partner follows only after 2 or 4 repetitions, and ends with the starter`, () => {
    for (const repetitions of [2, 4]) {
      for (const direction of [1, -1]) {
        const sim = new CircleTraining({ count: 5, repetitions, direction, mode });
        const firstPartner = direction === 1 ? 1 : 4;
        for (let i = 0; i < repetitions - 1; i++) {
          sim.advance();
          assert.equal(sim.people[firstPartner].phase, 'idle');
        }
        sim.advance();
        assert.equal(sim.people[firstPartner].phase, 'ready');
        assert.equal(sim.people[0].partnersDone, 1);
        const tour = [];
        for (let i = 0; i < 500 && tour.length < 4; i++) {
          sim.advance();
          tour.push(...sim.events.filter((event) => event.mover === firstPartner && event.cycle === 1).map((event) => event.partner));
        }
        assert.equal(tour.length, 4);
        assert.equal(tour.at(-1), 0);
      }
    }
  });

  test(`${mode}: all group sizes, directions and repetitions complete multiple tours without deadlocks`, () => {
    for (let count = 3; count <= 20; count++) {
      for (const direction of [1, -1]) {
        for (const repetitions of [2, 4]) {
          const sim = new CircleTraining({ count, direction, repetitions, starter: count - 1, mode });
          const tours = new Map();
          for (let tick = 0; tick < 12000; tick++) {
            checkPairs(sim);
            assert.ok(sim.pairs.length > 0 || sim.people.some((person) => person.phase === 'returning'), 'no deadlock');
            for (const person of sim.people) {
              if (person.phase === 'ready' && person.completedCycles > 0) {
                assert.ok(person.received.every((amount, id) => id === person.id || amount >= person.completedCycles), 'new tour requires a visit from every other participant');
              }
            }
            sim.advance();
            for (const event of sim.events) {
              const key = `${event.mover}:${event.cycle}`;
              if (!tours.has(key)) tours.set(key, []);
              tours.get(key).push(event.partner);
              assert.equal(event.throws, repetitions);
            }
            if (sim.people.every((person) => person.completedCycles >= 4)) break;
          }
          assert.ok(sim.people.every((person) => person.completedCycles >= 4));
          for (let mover = 0; mover < count; mover++) {
            for (let cycle = 1; cycle <= 4; cycle++) {
              const expected = Array.from({ length: count - 1 }, (_, offset) => (mover + direction * (offset + 1) + count) % count);
              assert.deepEqual(tours.get(`${mover}:${cycle}`), expected);
            }
          }
          assert.equal(sim.totalThrows, sim.completedPairs * repetitions + sim.pairs.reduce((sum, pair) => sum + pair.throws, 0));
        }
      }
    }
  });

  test(`${mode}: finishing a tour waits for incoming partners or the next predecessor signal`, () => {
    const sim = new CircleTraining({ count: 8, mode });
    let sawWaiting = false;
    for (let i = 0; i < 1000; i++) {
      sim.advance();
      for (const person of sim.people) {
        if (person.phase !== 'waiting') continue;
        sawWaiting = true;
        assert.equal(person.partnersDone, 7);
        const missingIncoming = person.received.some((amount, id) => id !== person.id && amount < person.completedCycles);
        const predecessor = (person.id - sim.direction + sim.count) % sim.count;
        const waitingForPredecessor = person.received[predecessor] < person.completedCycles + (person.id === sim.starter ? 0 : 1);
        assert.ok(missingIncoming || waitingForPredecessor);
      }
    }
    assert.ok(sawWaiting);
  });

  test(`${mode}: every completed tour includes a visible homecoming`, () => {
    const sim = new CircleTraining({ count: 3, mode });
    let homecomings = 0;
    for (let tick = 0; tick < 200; tick++) {
      sim.advance();
      for (const event of sim.events) {
        if (sim.people[event.mover].partnersDone !== sim.count - 1) continue;
        homecomings++;
        assert.equal(sim.people[event.mover].phase, 'returning');
        assert.ok(sim.pairs.every((pair) => pair.mover !== event.mover));
      }
    }
    assert.ok(homecomings > 3);
  });

  test(`${mode}: Partner 1 visits everyone, comes home, and Partner 2 is the first to visit him`, () => {
    for (const count of [3, 5, 8, 20]) {
      for (const repetitions of [2, 4]) {
        const sim = new CircleTraining({ count, repetitions, mode });
        const incoming = [];
        const outgoing = [];
        let sawHome = false;
        for (let tick = 0; tick < 3000 && incoming.length < count - 1; tick++) {
          if (sim.pairs.some((pair) => pair.partner === 0)) {
            assert.equal(sim.people[0].completedCycles, 1);
            assert.deepEqual(sim.roundProgress(sim.people[0]), { done: (count - 1) * repetitions, total: (count - 1) * repetitions, remaining: 0 });
          }
          sim.advance();
          if (sim.people[0].phase === 'returning') sawHome = true;
          for (const event of sim.events) {
            if (event.mover === 0 && event.cycle === 1) outgoing.push(event.partner);
            if (event.partner === 0 && event.cycle === 1) incoming.push(event.mover);
          }
        }
        const order = Array.from({ length: count - 1 }, (_, index) => index + 1);
        assert.deepEqual(outgoing, order);
        assert.deepEqual(incoming, order);
        assert.ok(sawHome);
      }
    }
  });

  test(`${mode}: only the direct predecessor activates a follower, for any starter and direction`, () => {
    for (let count = 3; count <= 20; count++) {
      for (const direction of [1, -1]) {
        for (let starter = 0; starter < count; starter++) {
          const sim = new CircleTraining({ count, direction, starter, mode });
          for (let tick = 0; tick < count * 12; tick++) {
            checkPairs(sim);
            for (const person of sim.people) {
              if (person.id === starter) continue;
              const predecessor = (person.id - direction + count) % count;
              if (person.received[predecessor] === 0) assert.equal(person.phase, 'idle');
            }
            sim.advance();
          }
          assert.ok(sim.people.every((person) => person.completedCycles >= 1));
        }
      }
    }
  });

  test(`${mode}: counters count each own repetition, not exercises with incoming travelers`, () => {
    for (const repetitions of [2, 4]) {
      const sim = new CircleTraining({ count: 5, repetitions, mode });
      const total = 4 * repetitions;
      for (let done = 0; done < total; done++) {
        assert.deepEqual(sim.roundProgress(sim.people[0]), { done, total, remaining: total - done });
        sim.advance();
      }
      assert.deepEqual(sim.roundProgress(sim.people[0]), { done: total, total, remaining: 0 });
      while (sim.people[0].received[1] === 0) sim.advance();
      assert.deepEqual(sim.roundProgress(sim.people[0]), { done: total, total, remaining: 0 });
    }
  });
}

test('Nage is the default; invalid settings are rejected', () => {
  assert.equal(new CircleTraining().mode, 'nage');
  for (const count of [2, 21, 3.5]) assert.throws(() => new CircleTraining({ count }), RangeError);
  assert.throws(() => new CircleTraining({ repetitions: 3 }), RangeError);
  assert.throws(() => new CircleTraining({ direction: 0 }), RangeError);
  assert.throws(() => new CircleTraining({ starter: 8 }), RangeError);
  assert.throws(() => new CircleTraining({ mode: 'invalid' }), RangeError);
});
