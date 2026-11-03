/* Pure layout: one figure per person; the stationary partner stays at home. */
(function (root) {
  'use strict';
  function circleLayout(simulation) {
    const radius = simulation.count > 15 ? 20 : 23;
    const point = (id, distance) => {
      const angle = -Math.PI / 2 + id * 2 * Math.PI / simulation.count;
      return { x: 320 + distance * Math.cos(angle), y: 320 + distance * Math.sin(angle), radius };
    };
    const homes = simulation.people.map((person) => point(person.id, 247));
    const people = simulation.people.map((person) => ({
      ...point(person.phase === 'ready' ? (person.id + simulation.direction * person.partnersDone + simulation.count) % simulation.count : person.id, person.phase === 'ready' ? 185 : 247),
      role: person.phase,
      moving: person.phase === 'ready',
      color: null,
    }));
    const pairs = simulation.pairs.map((pair) => {
      // Stable per traveler, with a unique hue for every participant in the group.
      const color = `hsl(${(pair.mover * 360 / simulation.count + 25) % 360} 75% 70%)`;
      people[pair.mover] = { ...point(pair.partner, 185), role: simulation.mode, moving: true, color };
      people[pair.partner] = { ...homes[pair.partner], role: simulation.mode === 'nage' ? 'uke' : 'nage', moving: false, color };
      return { ...pair, color };
    });
    return { homes, people, pairs };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { circleLayout };
  else root.circleLayout = circleLayout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
