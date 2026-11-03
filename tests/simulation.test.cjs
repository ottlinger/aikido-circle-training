const test = require('node:test');
const assert = require('node:assert/strict');
const { CircleTraining } = require('../simulation.js');

function checkPairs(simulation) {
  const used = new Set();
  for (const pair of simulation.pairs) {
    assert.notEqual(pair.tori, pair.uke);
    assert.equal(used.has(pair.tori), false, 'Tori must not be in two pairs');
    assert.equal(used.has(pair.uke), false, 'Uke must not be in two pairs');
    used.add(pair.tori);
    used.add(pair.uke);
    assert.equal(pair.uke, simulation.target(simulation.people[pair.tori]));
    assert.notEqual(simulation.people[pair.uke].phase, 'ready', 'an active thrower must never receive');
    assert.equal(pair.tori, simulation.incomingThrower(simulation.people[pair.uke]), 'followers must not overtake');
  }
}

test('first uke follows only after 2 or 4 throws, and ends with the original starter', () => {
  for (const repetitions of [2, 4]) {
    for (const direction of [1, -1]) {
      const sim = new CircleTraining({ count: 5, repetitions, direction });
      const firstUke = direction === 1 ? 1 : 4;
      for (let i = 0; i < repetitions - 1; i++) {
        sim.advance();
        assert.equal(sim.people[firstUke].phase, 'idle');
      }
      sim.advance();
      assert.equal(sim.people[firstUke].phase, 'ready');
      assert.equal(sim.people[0].partnersDone, 1);
      const tour = [];
      for (let i = 0; i < 500 && tour.length < 4; i++) {
        sim.advance();
        tour.push(...sim.events.filter((event) => event.tori === firstUke && event.cycle === 1).map((event) => event.uke));
      }
      assert.equal(tour.length, 4);
      assert.equal(tour.at(-1), 0);
    }
  }
});

test('all group sizes, directions, and repetitions: everyone trains with everyone without deadlocks', () => {
  for (let count = 3; count <= 20; count++) {
    for (const direction of [1, -1]) {
      for (const repetitions of [2, 4]) {
        const sim = new CircleTraining({ count, direction, repetitions, starter: count - 1 });
        const tours = new Map();
        for (let tick = 0; tick < 12000; tick++) {
          checkPairs(sim);
          assert.ok(sim.pairs.length > 0 || sim.people.some((person) => person.phase === 'returning'), `deadlock: n=${count}, direction=${direction}, repetitions=${repetitions}`);
          for (const person of sim.people) {
            if (person.phase === 'ready' && person.completedCycles > 0) {
              assert.ok(person.received.every((amount, id) => id === person.id || amount >= person.completedCycles), 'new tour requires an incoming pair from every other person');
            }
          }
          sim.advance();
          for (const event of sim.events) {
            const key = `${event.tori}:${event.cycle}`;
            if (!tours.has(key)) tours.set(key, []);
            tours.get(key).push(event.uke);
            assert.equal(event.throws, repetitions);
          }
          if (sim.people.every((person) => person.completedCycles >= 4)) break;
        }
        assert.ok(sim.people.every((person) => person.completedCycles >= 4), 'everyone completes multiple tours');
        for (let tori = 0; tori < count; tori++) {
          for (let cycle = 1; cycle <= 4; cycle++) {
            const expected = Array.from({ length: count - 1 }, (_, offset) => (tori + direction * (offset + 1) + count) % count);
            assert.deepEqual(tours.get(`${tori}:${cycle}`), expected);
          }
        }
        assert.equal(sim.totalThrows, sim.completedPairs * repetitions + sim.pairs.reduce((sum, pair) => sum + pair.throws, 0));
      }
    }
  }
});

test('finishing a tour makes a participant wait for remaining incoming partners', () => {
  const sim = new CircleTraining({ count: 8 });
  let sawWaiting = false;
  for (let i = 0; i < 1000; i++) {
    sim.advance();
    for (const person of sim.people) {
      if (person.phase === 'waiting') {
        sawWaiting = true;
        assert.equal(person.partnersDone, 7);
        const missingIncoming = person.received.some((amount, id) => id !== person.id && amount < person.completedCycles);
        const predecessor = (person.id - sim.direction + sim.count) % sim.count;
        const waitingForPredecessor = person.received[predecessor] < person.completedCycles + (person.id === sim.starter ? 0 : 1);
        assert.ok(missingIncoming || waitingForPredecessor);
      }
    }
  }
  assert.ok(sawWaiting);
});

test('every completed tour includes a visible homecoming before the next tour', () => {
  const sim = new CircleTraining({ count: 3 });
  let homecomings = 0;
  for (let tick = 0; tick < 200; tick++) {
    sim.advance();
    for (const event of sim.events) {
      if (sim.people[event.tori].partnersDone !== sim.count - 1) continue;
      homecomings++;
      assert.equal(sim.people[event.tori].phase, 'returning');
      assert.ok(sim.pairs.every((pair) => pair.tori !== event.tori));
    }
  }
  assert.ok(homecomings > 3);
});

test('Partner 1 completes every throw, comes home, and is first thrown by Partner 2', () => {
  for (const count of [3, 5, 8, 20]) {
    for (const repetitions of [2, 4]) {
      const sim = new CircleTraining({ count, repetitions });
      const starterIncoming = [];
      const starterOutgoing = [];
      let sawHome = false;
      for (let tick = 0; tick < 3000 && starterIncoming.length < count - 1; tick++) {
        if (sim.pairs.some((pair) => pair.uke === 0)) {
          assert.equal(sim.people[0].completedCycles, 1);
          assert.deepEqual(sim.roundProgress(sim.people[0]), { done: (count - 1) * repetitions, total: (count - 1) * repetitions, remaining: 0 });
        }
        sim.advance();
        if (sim.people[0].phase === 'returning') sawHome = true;
        for (const event of sim.events) {
          if (event.tori === 0 && event.cycle === 1) starterOutgoing.push(event.uke);
          if (event.uke === 0 && event.cycle === 1) starterIncoming.push(event.tori);
        }
      }
      const order = Array.from({ length: count - 1 }, (_, index) => index + 1);
      assert.deepEqual(starterOutgoing, order);
      assert.deepEqual(starterIncoming, order, 'Partner 2 throws Partner 1 first, then 3, 4, …');
      assert.ok(sawHome);
    }
  }
});

test('only the direct predecessor activates a follower, for any starter and direction', () => {
  for (let count = 3; count <= 20; count++) {
    for (const direction of [1, -1]) {
      for (let starter = 0; starter < count; starter++) {
        const sim = new CircleTraining({ count, direction, starter });
        for (let tick = 0; tick < count * 12; tick++) {
          checkPairs(sim);
          for (const person of sim.people) {
            if (person.id === starter) continue;
            const predecessor = (person.id - direction + count) % count;
            if (person.received[predecessor] === 0) assert.equal(person.phase, 'idle', 'earlier throwers cannot start this participant');
          }
          sim.advance();
        }
        assert.ok(sim.people.every((person) => person.completedCycles >= 1));
      }
    }
  }
});

test('round counters count every individual throw and exclude received throws', () => {
  for (const repetitions of [2, 4]) {
    const sim = new CircleTraining({ count: 5, repetitions });
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

test('invalid settings are rejected', () => {
  for (const count of [2, 21, 3.5]) assert.throws(() => new CircleTraining({ count }), RangeError);
  assert.throws(() => new CircleTraining({ repetitions: 3 }), RangeError);
  assert.throws(() => new CircleTraining({ direction: 0 }), RangeError);
  assert.throws(() => new CircleTraining({ starter: 8 }), RangeError);
});
