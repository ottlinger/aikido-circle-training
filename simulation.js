/* Shared by the browser and the dependency-free Node tests. */
(function (root) {
  'use strict';

  class CircleTraining {
    constructor({ count = 8, repetitions = 2, direction = 1, starter = 0 } = {}) {
      if (!Number.isInteger(count) || count < 3 || count > 20) throw new RangeError('Teilnehmerzahl: 3–20');
      if (![2, 4].includes(repetitions)) throw new RangeError('Wiederholungen: 2 oder 4');
      if (![1, -1].includes(direction)) throw new RangeError('Ungültige Richtung');
      if (!Number.isInteger(starter) || starter < 0 || starter >= count) throw new RangeError('Ungültiger Startpartner');
      this.count = count;
      this.repetitions = repetitions;
      this.direction = direction;
      this.totalThrows = 0;
      this.completedPairs = 0;
      this.starter = starter;
      this.order = Array.from({ length: count }, (_, offset) => (starter + direction * offset + count) % count);
      this.events = [];
      this.people = Array.from({ length: count }, (_, id) => ({
        id,
        phase: id === starter ? 'ready' : 'idle',
        partnersDone: 0,
        completedCycles: 0,
        // Completed incoming partner exercises, in the order of the following wave.
        received: Array(count).fill(0),
      }));
      this.pairs = [];
      this.schedule();
    }

    target(person) {
      return (person.id + this.direction * (person.partnersDone + 1) + this.count) % this.count;
    }

    roundProgress(person) {
      const currentPair = this.pairs.find((pair) => pair.tori === person.id);
      const done = person.partnersDone * this.repetitions + (currentPair ? currentPair.throws : 0);
      const total = (this.count - 1) * this.repetitions;
      return { done, total, remaining: total - done };
    }

    incomingThrower(person) {
      const order = this.order.filter((id) => id !== person.id);
      const receivedPairs = person.received.reduce((sum, amount) => sum + amount, 0);
      return order[receivedPairs % order.length];
    }

    schedule() {
      const occupied = new Set();
      this.pairs = [];
      for (const id of this.order) {
        const person = this.people[id];
        if (person.phase !== 'ready') continue;
        const uke = this.target(person);
        const receiver = this.people[uke];
        // A moving thrower never receives. Followers cannot overtake the wave.
        if (receiver.phase === 'ready' || this.incomingThrower(receiver) !== id) continue;
        if (occupied.has(id) || occupied.has(uke)) continue;
        occupied.add(id);
        occupied.add(uke);
        this.pairs.push({ tori: id, uke, throws: 0 });
      }
    }

    wakeWaiting() {
      for (const person of this.people) {
        if (!['idle', 'waiting'].includes(person.phase)) continue;
        const predecessor = (person.id - this.direction + this.count) % this.count;
        const required = person.completedCycles + (person.id === this.starter ? 0 : 1);
        const predecessorHasPassed = person.received[predecessor] >= required;
        const allHaveThrown = person.received.every((amount, id) => id === person.id || amount >= person.completedCycles);
        // Only the direct predecessor starts a follower, not any earlier thrower.
        if (predecessorHasPassed && allHaveThrown) {
          person.phase = 'ready';
          person.partnersDone = 0;
        }
      }
    }

    advance() {
      this.events = [];
      // Keep the homecoming visible for at least one state before a new tour.
      for (const person of this.people) {
        if (person.phase === 'returning') person.phase = 'waiting';
      }
      this.wakeWaiting();
      for (const pair of this.pairs) {
        pair.throws++;
        this.totalThrows++;
      }
      if (this.pairs.length && this.pairs[0].throws < this.repetitions) return;

      for (const pair of this.pairs) {
        const tori = this.people[pair.tori];
        const uke = this.people[pair.uke];
        uke.received[tori.id]++;
        tori.partnersDone++;
        this.completedPairs++;
        this.events.push({ ...pair, cycle: tori.completedCycles + 1 });
        if (tori.partnersDone === this.count - 1) {
          tori.completedCycles++;
          tori.phase = 'returning';
        }
      }

      this.wakeWaiting();
      this.schedule();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { CircleTraining };
  else root.CircleTraining = CircleTraining;
})(typeof globalThis !== 'undefined' ? globalThis : this);
