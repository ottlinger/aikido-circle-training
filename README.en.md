# Aikidō Circle Training · Keiko 稽古

[Deutsch](README.md) | **English**

A local JavaScript application that visualizes Aikidō circle training. Training always takes place **between two partners**, Nage and Uke; the circle organizes everyone training with everyone. No personal data, backend, external libraries or external network requests are required. The footer links to the [GitHub repository](https://github.com/ottlinger/aikido-circle-training).

## Getting started

Open `index.html` directly in a browser. No build or installation is required.

Alternatively, use a local web server:

```sh
python3 -m http.server 8888
```

Then open <http://localhost:8888>. The existing Docker configuration also works: `docker compose up -d`, using the same address.

## Controls

- **Language:** Choose **Deutsch** or **English** in the top-right corner. **German is the default on every page load**, regardless of the browser language. Switching translates the entire interface, including the circle, status messages, counters, explanations and screen-reader text, without pausing or resetting the session. The language choice is not stored.
- A random group of **3–20 participants** is selected on page load. Use the slider or “Random group” to change it.
- Select a direction, **2 or 4 repetitions per partner**, a starting partner and the **role inside the circle**: **Nage moves and throws** (default) or **Uke moves and attacks**.
- Start, pause, advance one step at a time or reset.
- Language and speed can also be changed while training is running. Other settings reset the session.
- Each active pair shares one color. The inner participant is filled; the stationary circle partner has a colored outline. **N** identifies Nage and **U** identifies Uke. Their positions depend on the mode. Blue means returning/waiting; dashed circles mark vacant home positions.
- Each inner figure shows **completed / total**, such as `8/14`. The lists and starting-partner summary also show **remaining throws** in Nage mode or **remaining attacks** in Uke mode. Arrows point from the inner participant to the stationary circle partner, indicating the throw or attack direction.
- An own round consists of `(participant count − 1) × repetitions`. In Uke mode, one repetition is an attack followed by a throw by the stationary Nage. The attack is not counted as an additional step. The total throw statistic counts actual simulated throws in either mode. Exercises with followers visiting afterwards do not change the completed own-round counter.
- “Rounds completed by everyone” is the number of inner rounds that every participant has completed. The center displays **Keiko**, the logo **合気 (Aiki)**, and the footer **稽古 (Keiko)**.

## Simulation model

Numbered home positions remain fixed. In the default mode, **Nage** moves inside to each stationary **Uke** and throws them. In the second mode, **Uke** moves inside to each stationary **Nage**, attacks and is thrown by Nage. Partners change after 2 or 4 repetitions. The inner participant returns visibly to their home position only after visiting every other partner. If the next partner is unavailable, the participant waits inside at the last visited circle position, behind the predecessor.

Home markers are orientation aids, not extra people: each participant has exactly one figure. Movement is schematic, not a physics simulation.

1. The starting partner trains with the next neighbor in the chosen direction.
2. After 2 or 4 repetitions, the starter moves on. The first partner follows at a distance in the same inner role. Every other participant starts only after training with their **direct predecessor**: Partner 3 after Partner 2, not already after Partner 1.
3. Everyone visits every other participant exactly once per own round, in the chosen direction. The first follower finishes with the original starting partner.
4. After completing their own round, each participant returns home and waits for every other participant to visit for that round. At home, they are Uke when Nage moves, or Nage when Uke moves.

**The wave has a fixed order.** Multiple independent pairs may train simultaneously, but nobody overtakes. An inner participant **never becomes a stationary circle partner or changes role midway** through their own round. At each home position, visitors arrive in the fixed order of the starting partner and followers, skipping the person at that position. An occupied partner or a predecessor who has not yet passed causes a wait.

Example: 5 participants, Partner 1 starts, clockwise, 2 throws per partner. Partner 1 throws **2 → 3 → 4 → 5**, completing **8 throws**, then returns home. Partner 2 follows with **3 → 4 → 5 → 1** and is therefore the first to throw the returned Partner 1. Partners 3, 4 and 5 follow. Partner 3 only starts after **2 → 3**.

In Uke mode, Partner 1 also visits **2 → 3 → 4 → 5**, attacks each twice and receives **8 throws**. Partner 2 follows as Uke with **3 → 4 → 5 → 1**. After Partner 1 returns, Partner 2 is the first to attack them; Partner 1 throws Partner 2 at the fixed circle position.

Before starting the next round, every other participant must have visited for the previous round. The original starter opens the new wave; followers join again after training with their direct predecessor. Incoming completed exercises are counted per visitor. One simulation step is one throw **per active pair**. After the last repetition, the next conflict-free pairs are formed. Homecoming is visible for at least one state. If everyone is returning, the next step changes partners without a throw.

## Files and tests

- `index.html`: interface and SVG training circle
- `styles.css`: responsive styling, colors and animations; respects reduced motion
- `simulation.js`: role-independent partner changes (`mover`/`partner`) and mode-specific Nage/Uke assignment; testable with Node.js
- `visualization.js`: fixed home positions, moving Nage or Uke and pair colors
- `i18n.js`: local German/English translations, placeholders and number formatting
- `app.js`: browser controls, language switching and SVG animation
- `tests/simulation.test.cjs`, `tests/visualization.test.cjs`, `tests/i18n.test.cjs`: dependency-free tests

With Node.js 18 or newer:

```sh
node --test tests/*.test.cjs
```

Tests cover both modes, all group sizes, both directions and both repetition counts across multiple rounds: no double booking, no overtaking, no role changes during an inner round, correct sequence, activation only by the direct predecessor, waiting conditions, visible homecoming and no deadlocks. Counter tests check each completed/remaining repetition. Layout tests verify positions, Nage/Uke assignment, unique pair colors and one figure per participant. Translation tests verify the German default, complete language catalogs, matching placeholders, static and dynamic text, screen-reader labels and locale-specific number formatting.
