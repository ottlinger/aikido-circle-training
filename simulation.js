/* Shared by the browser and the dependency-free Node tests. */
(function (root) {
  'use strict';

  class CircleTraining {
    constructor({ count = 8, repetitions = 2, direction = 1, starter = 0, mode = 'nage', rounds = Infinity } = {}) {
      if (!Number.isInteger(count) || count < 3 || count > 20) throw new RangeError('Teilnehmerzahl: 3–20');
      if (![2, 4].includes(repetitions)) throw new RangeError('Wiederholungen: 2 oder 4');
      if (![1, -1].includes(direction)) throw new RangeError('Ungültige Richtung');
      if (!Number.isInteger(starter) || starter < 0 || starter >= count) throw new RangeError('Ungültiger Startpartner');
      if (!['nage', 'uke'].includes(mode)) throw new RangeError('Ungültiger Trainingsmodus');
      if (rounds !== Infinity && (!Number.isSafeInteger(rounds) || rounds < 1)) throw new RangeError('Ungültige Rundenzahl');
      this.rounds = rounds;
      this.mode = mode;
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

    get finished() {
      return this.people.every((person) => person.completedCycles >= this.rounds);
    }

    target(person) {
      return (person.id + this.direction * (person.partnersDone + 1) + this.count) % this.count;
    }

    roundProgress(person) {
      const currentPair = this.pairs.find((pair) => pair.mover === person.id);
      const done = person.partnersDone * this.repetitions + (currentPair ? currentPair.throws : 0);
      const total = (this.count - 1) * this.repetitions;
      return { done, total, remaining: total - done };
    }

    pairRoles(pair) {
      return this.mode === 'nage'
        ? { nage: pair.mover, uke: pair.partner }
        : { nage: pair.partner, uke: pair.mover };
    }

    incomingMover(person) {
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
        const partner = this.target(person);
        const receiver = this.people[partner];
        // A traveler never becomes a stationary partner mid-tour. No overtaking.
        if (receiver.phase === 'ready' || this.incomingMover(receiver) !== id) continue;
        if (occupied.has(id) || occupied.has(partner)) continue;
        occupied.add(id);
        occupied.add(partner);
        this.pairs.push({ mover: id, partner, throws: 0 });
      }
    }

    wakeWaiting() {
      for (const person of this.people) {
        if (!['idle', 'waiting'].includes(person.phase) || person.completedCycles >= this.rounds) continue;
        const predecessor = (person.id - this.direction + this.count) % this.count;
        const required = person.completedCycles + (person.id === this.starter ? 0 : 1);
        const predecessorHasPassed = person.received[predecessor] >= required;
        const allHavePassed = person.received.every((amount, id) => id === person.id || amount >= person.completedCycles);
        // Only the direct predecessor starts a follower, not any earlier traveler.
        if (predecessorHasPassed && allHavePassed) {
          person.phase = 'ready';
          person.partnersDone = 0;
        }
      }
    }

    advance() {
      this.events = [];
      if (this.finished) return;
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
        const mover = this.people[pair.mover];
        const partner = this.people[pair.partner];
        partner.received[mover.id]++;
        mover.partnersDone++;
        this.completedPairs++;
        this.events.push({ ...pair, cycle: mover.completedCycles + 1 });
        if (mover.partnersDone === this.count - 1) {
          mover.completedCycles++;
          mover.phase = 'returning';
        }
      }

      this.wakeWaiting();
      this.schedule();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { CircleTraining };
  else root.CircleTraining = CircleTraining;
})(typeof globalThis !== 'undefined' ? globalThis : this);
