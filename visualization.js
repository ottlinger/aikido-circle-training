/* Pure layout: a participant exists once; Uke always stays at their home. */
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
      color: null,
    }));
    const pairs = simulation.pairs.map((pair) => {
      // Stable per thrower, with a unique hue for every participant in the group.
      const color = `hsl(${(pair.tori * 360 / simulation.count + 25) % 360} 75% 70%)`;
      people[pair.tori] = { ...point(pair.uke, 185), role: 'tori', color };
      people[pair.uke] = { ...homes[pair.uke], role: 'uke', color };
      return { ...pair, color };
    });
    return { homes, people, pairs };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { circleLayout };
  else root.circleLayout = circleLayout;
})(typeof globalThis !== 'undefined' ? globalThis : this);
