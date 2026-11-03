# Aikido Circle Training · Keiko 稽古

Eine lokale JavaScript-Anwendung zur Visualisierung des Aikido-Trainingskreises. Geübt wird **immer zwischen zwei Partnern** (Nage und Uke); der Kreis organisiert das Training aller mit allen. Keine personenbezogenen Daten, kein Backend, keine externen Bibliotheken oder Netzwerkanfragen.

## Starten

`index.html` direkt im Browser öffnen. Kein Build und keine Installation erforderlich.

Alternativ über einen lokalen Webserver:

```sh
python3 -m http.server 8888
```

Dann <http://localhost:8888> öffnen. Mit der vorhandenen Docker-Konfiguration geht auch `docker compose up -d` (gleiche Adresse).

## Bedienung

- Beim Laden wird eine zufällige Gruppengröße von **3 bis 20** gewählt. Über den Regler oder „Zufällige Gruppe“ lässt sie sich ändern.
- Richtung, **2 oder 4 Würfe pro Partner** und Startpartner wählen.
- Starten, pausieren, einzelne Würfe schrittweise ausführen oder zurücksetzen.
- Das Tempo lässt sich auch während des Trainings ändern. Andere Einstellungen setzen das Training zurück.
- Jedes aktive Zweierpaar hat eine eigene gemeinsame Farbe, die auch in der Paarliste erscheint. Nage steht innen (ausgefüllt, **N**), Uke am Kreisplatz (farbiger Rand, **U**). Blau bedeutet Rückkehr/Warten; gestrichelte nummerierte Kreise markieren freie Startplätze.
- An jeder laufenden Nage-Figur steht **ausgeführt / insgesamt**, z. B. `8/14`. Die Paar- und Teilnehmerlisten zeigen zusätzlich die **noch verbleibenden Würfe**. Die Übersicht oberhalb des Kreises hebt den Startpartner hervor.
- Eine eigene Runde umfasst `(Teilnehmerzahl − 1) × Wiederholungen` Würfe. Würfe, die man selbst empfängt, verändern diesen Nage-Zähler nicht. „Runden aller Teilnehmer“ ist die Zahl der Runden, die jeder bereits als Nage beendet hat.

## Simulationsmodell

Die nummerierten Startplätze bleiben fest. Nage bewegt sich animiert im Kreisinneren zum jeweiligen Uke, der immer an seinem eigenen Kreisplatz steht. Nach der letzten Partnerübung kehrt Nage sichtbar an seinen Startplatz zurück, bevor er erneut starten darf. Wartet ein aktiver Nage auf den nächsten Partner, bleibt er innen beim zuletzt besuchten Kreisplatz – hinter seinem Vorgänger. Die Plätze sind Orientierungshilfen, keine zusätzlichen Personen; jeder Teilnehmer hat genau eine Figur. Die Bewegung ist schematisch, keine physikalische Simulation.

1. Der Startpartner übt mit dem nächsten Nachbarn in der gewählten Richtung.
2. Nach 2 oder 4 Würfen wechselt er zum nächsten Partner. Sein erster Uke folgt nun mit Abstand. Jeder weitere Teilnehmer beginnt erst, nachdem sein **direkter Vorgänger** ihn geworfen hat: Partner 3 nach Partner 2, nicht bereits nach Partner 1.
3. Jeder besucht alle anderen genau einmal pro eigener Runde, in der gewählten Kreisrichtung. Der erste Nachfolger endet beim ursprünglichen Startpartner.
4. Nach der eigenen Runde kehrt ein Teilnehmer an seinen Startplatz zurück und wartet, bis jeder andere ihn für diese Runde geworfen hat. Dann startet er erneut. Er steht auch während des Wartens als Uke zur Verfügung.

**Die Welle hat eine feste Reihenfolge:** Es können mehrere unabhängige Zweierpaare gleichzeitig trainieren, aber niemand überholt seinen Vorgänger. Ein laufender Nage wird **niemals selbst Uke**, bevor er alle eigenen Würfe beendet hat und wieder am Startplatz steht. Auch an jedem Kreisplatz kommen die Werfer in der festen Reihenfolge des Startpartners und seiner Nachfolger vorbei (die eigene Person wird übersprungen). Ein belegtes Ziel oder ein noch nicht vorbeigegangener Vorgänger führt zu einer Pause.

Beispiel: 5 Teilnehmer, Startpartner 1, Uhrzeigersinn, 2 Würfe pro Partner. Partner 1 wirft **2 → 3 → 4 → 5**, insgesamt **8 Würfe**, und kehrt dann zurück. Partner 2 folgt mit **3 → 4 → 5 → 1**. Somit ist Partner 2 der erste, der den zurückgekehrten Partner 1 wirft. Danach folgen Partner 3, 4 und 5. Partner 3 startet erst nach der Übung **2 → 3**.

Für die nächste Runde müssen alle anderen einen für die vorherige Runde geworfen haben. Der Startpartner eröffnet die neue Welle; die Nachfolger steigen erneut ein, wenn ihr direkter Vorgänger sie geworfen hat. So bleibt auch über mehrere Zyklen hinweg der Abstand erhalten. Eingehende abgeschlossene Partnerübungen werden pro Werfer gezählt. Ein Simulationsschritt ist ein Wurf **je aktuellem Paar**; nach der letzten Wiederholung werden die nächsten konfliktfreien Paare gebildet. Die Rückkehr wird mindestens einen Zustand lang gezeigt. Falls gerade alle zurückkehren, ist der nächste Schritt ein Partnerwechsel ohne Wurf.

## Dateien und Tests

- `index.html`: Oberfläche und SVG-Trainingskreis
- `styles.css`: responsive Darstellung, Farben und Animationen; berücksichtigt reduzierte Bewegung
- `simulation.js`: eigenständiges Simulationsmodell, auch mit Node.js testbar
- `visualization.js`: reines Layoutmodell für feste Kreisplätze, bewegte Nage und Paarfarben
- `app.js`: Browsersteuerung und SVG-Animation
- `tests/simulation.test.cjs`, `tests/visualization.test.cjs`: Tests ohne zusätzliche Abhängigkeiten

Mit Node.js (18 oder neuer):

```sh
node --test tests/*.test.cjs
```

Die Tests prüfen alle Gruppengrößen, beide Richtungen und beide Wiederholungszahlen über mehrere Runden: keine Doppelbelegung, kein Überholen, keine Würfe gegen laufende Nage, korrekte Partnerreihenfolge, Einstieg ausschließlich durch den direkten Vorgänger, Wartebedingung, sichtbare Rückkehr und kein Stillstand. Der beschriebene Ablauf „Partner 1 wirft alle, kommt zurück und wird zuerst von Partner 2 geworfen“ ist ausdrücklich getestet. Zählertests prüfen jeden einzelnen ausgeführten/verbleibenden Wurf. Layouttests prüfen feste Uke-Positionen, Nage im Inneren beim jeweiligen Partner, eindeutige Paarfarben und genau eine Figur pro Person.
