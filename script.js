const samplePlayers = [
  "Alicia, 3.5",
  "Ben, 3.0",
  "Chen, 4.0",
  "Divya, 3.5",
  "Ethan, 2.5",
  "Farah, 3.0",
  "Grace, 4.0",
  "Hiro, 3.5",
  "Ivy, 3.0",
  "Jon, 3.5",
  "Kai, 2.5",
  "Lena, 4.0",
  "Maya, 3.0",
  "Noah, 3.5"
];

const sampleFixedPairs = [
  "Alicia + Ben",
  "Chen + Divya"
];

const el = {
  playersInput: document.querySelector("#playersInput"),
  fixedPairsInput: document.querySelector("#fixedPairsInput"),
  courtCount: document.querySelector("#courtCount"),
  roundCount: document.querySelector("#roundCount"),
  playersPerCourt: document.querySelector("#playersPerCourt"),
  balanceStyle: document.querySelector("#balanceStyle"),
  avoidRepeats: document.querySelector("#avoidRepeats"),
  rotateSits: document.querySelector("#rotateSits"),
  generateBtn: document.querySelector("#generateBtn"),
  loadSample: document.querySelector("#loadSample"),
  schedule: document.querySelector("#schedule"),
  statusText: document.querySelector("#statusText"),
  playerCount: document.querySelector("#playerCount"),
  courtSummary: document.querySelector("#courtSummary"),
  roundSummary: document.querySelector("#roundSummary"),
  copyBtn: document.querySelector("#copyBtn"),
  downloadBtn: document.querySelector("#downloadBtn")
};

let lastSchedule = null;
let generationCount = 0;

function parsePlayers(text) {
  const seen = new Set();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [namePart, skillPart] = line.split(",").map((part) => part.trim());
      const name = namePart || `Player ${index + 1}`;
      const skill = Number.parseFloat(skillPart);
      return {
        id: playerId(name) || `player-${index}`,
        name,
        skill: Number.isFinite(skill) ? skill : 3
      };
    })
    .filter((player) => {
      if (seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    });
}

function shuffle(items, seed) {
  const copy = [...items];
  let state = seed || 1234567;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const swapIndex = state % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pairKey(a, b) {
  return [a.id, b.id].sort().join("|");
}

function playerId(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFixedPairs(text, players) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const pairedIds = new Set();
  const pairs = [];
  const warnings = [];

  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const names = line
        .split(/\s+(?:and)\s+|[+&/|]/i)
        .map((name) => name.trim())
        .filter(Boolean);

      if (names.length !== 2) {
        warnings.push(`Could not read fixed pair: ${line}`);
        return;
      }

      const pair = names.map((name) => playersById.get(playerId(name)));
      const missing = names.filter((name, index) => !pair[index]);
      if (missing.length) {
        warnings.push(`Unknown player in fixed pair: ${missing.join(", ")}`);
        return;
      }

      if (pair.some((player) => pairedIds.has(player.id))) {
        warnings.push(`A player can only be in one fixed pair: ${line}`);
        return;
      }

      pair.forEach((player) => pairedIds.add(player.id));
      pairs.push({ players: pair, fixed: true });
    });

  return { pairs, warnings, pairedIds };
}

function makeUnits(players, fixedPairs, pairedIds) {
  const pairedUnits = fixedPairs.map((pair) => ({ players: pair.players, fixed: true }));
  const singleUnits = players
    .filter((player) => !pairedIds.has(player.id))
    .map((player) => ({ players: [player], fixed: false }));
  return [...pairedUnits, ...singleUnits];
}

function updateSummary() {
  const players = parsePlayers(el.playersInput.value);
  const courts = Number.parseInt(el.courtCount.value, 10) || 0;
  const rounds = Number.parseInt(el.roundCount.value, 10) || 0;
  el.playerCount.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
  el.courtSummary.textContent = `${courts} court${courts === 1 ? "" : "s"}`;
  el.roundSummary.textContent = `${rounds} round${rounds === 1 ? "" : "s"}`;
}

function chooseUnitsForRound(units, capacity, sitOutCounts, rotateSits, roundIndex, seedOffset) {
  const ordered = shuffle(units, 9000 + seedOffset + roundIndex * 31);
  if (!rotateSits || units.reduce((sum, unit) => sum + unit.players.length, 0) <= capacity) {
    return takeUnitsToCapacity(ordered, capacity);
  }

  return ordered
    .sort((a, b) => unitSitOutScore(b, sitOutCounts) - unitSitOutScore(a, sitOutCounts) || unitName(a).localeCompare(unitName(b)))
    .reduce((chosen, unit) => {
      const used = chosen.reduce((sum, chosenUnit) => sum + chosenUnit.players.length, 0);
      if (used + unit.players.length <= capacity) chosen.push(unit);
      return chosen;
    }, []);
}

function takeUnitsToCapacity(units, capacity) {
  const chosen = [];
  let used = 0;
  units.forEach((unit) => {
    if (used + unit.players.length <= capacity) {
      chosen.push(unit);
      used += unit.players.length;
    }
  });
  return chosen;
}

function unitSitOutScore(unit, sitOutCounts) {
  return Math.min(...unit.players.map((player) => sitOutCounts.get(player.id) || 0));
}

function unitName(unit) {
  return unit.players.map((player) => player.name).join(" + ");
}

function sortUnitsForBalance(units, balanceStyle, roundIndex, seedOffset) {
  if (balanceStyle === "shuffle") return shuffle(units, 2000 + seedOffset + roundIndex * 31);
  if (balanceStyle === "skill") return [...units].sort((a, b) => unitSkill(a) - unitSkill(b));

  const lowToHigh = [...units].sort((a, b) => unitSkill(a) - unitSkill(b));
  const mixed = [];
  while (lowToHigh.length) {
    mixed.push(lowToHigh.shift());
    if (lowToHigh.length) mixed.push(lowToHigh.pop());
  }
  return shuffle(mixed, 3000 + seedOffset + roundIndex * 31);
}

function unitSkill(unit) {
  return unit.players.reduce((sum, player) => sum + player.skill, 0) / unit.players.length;
}

function buildCourtGroups(units, playersPerCourt, courts) {
  const remaining = [...units];
  const groups = [];

  for (let court = 0; court < courts; court += 1) {
    const group = [];
    while (group.flatMap((unit) => unit.players).length < playersPerCourt) {
      const needed = playersPerCourt - group.flatMap((unit) => unit.players).length;
      const nextIndex = remaining.findIndex((unit) => unit.players.length <= needed);
      if (nextIndex === -1) break;
      group.push(...remaining.splice(nextIndex, 1));
    }

    if (group.flatMap((unit) => unit.players).length === playersPerCourt) {
      groups.push(group);
    }
  }

  return groups;
}

function makeDoublesMatch(units, partnerCounts, avoidRepeats) {
  const group = units.flatMap((unit) => unit.players);
  if (group.length < 4) return null;

  const fixedPair = units.find((unit) => unit.fixed && unit.players.length === 2);
  if (fixedPair) {
    const opponents = group.filter((player) => !fixedPair.players.some((pairedPlayer) => pairedPlayer.id === player.id));
    return { teamA: fixedPair.players, teamB: opponents };
  }

  const candidates = [
    [[group[0], group[3]], [group[1], group[2]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[1]], [group[2], group[3]]]
  ];

  return candidates
    .map(([teamA, teamB]) => {
      const skillGap = Math.abs(teamA[0].skill + teamA[1].skill - teamB[0].skill - teamB[1].skill);
      const repeatPenalty = avoidRepeats
        ? (partnerCounts.get(pairKey(teamA[0], teamA[1])) || 0) + (partnerCounts.get(pairKey(teamB[0], teamB[1])) || 0)
        : 0;
      return { teamA, teamB, score: skillGap + repeatPenalty * 3 };
    })
    .sort((a, b) => a.score - b.score)[0];
}

function makeSinglesMatch(group) {
  if (group.length < 2) return null;
  return { teamA: [group[0]], teamB: [group[1]] };
}

function generateSchedule() {
  const players = parsePlayers(el.playersInput.value);
  const fixedPairsResult = parseFixedPairs(el.fixedPairsInput.value, players);
  const units = makeUnits(players, fixedPairsResult.pairs, fixedPairsResult.pairedIds);
  const courts = clamp(Number.parseInt(el.courtCount.value, 10), 1, 12);
  const rounds = clamp(Number.parseInt(el.roundCount.value, 10), 1, 50);
  const playersPerCourt = Number.parseInt(el.playersPerCourt.value, 10);
  const capacity = courts * playersPerCourt;
  const partnerCounts = new Map();
  const sitOutCounts = new Map(players.map((player) => [player.id, 0]));
  const schedule = [];
  const seedOffset = generationCount * 100000;

  if (players.length < playersPerCourt) {
    return { error: `Add at least ${playersPerCourt} players to generate a match.` };
  }

  if (playersPerCourt === 2 && fixedPairsResult.pairs.length) {
    return { error: "Fixed pairs are only available for doubles sessions." };
  }

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const activeUnits = chooseUnitsForRound(units, Math.min(players.length, capacity), sitOutCounts, el.rotateSits.checked, roundIndex, seedOffset);
    const active = activeUnits.flatMap((unit) => unit.players);
    const activeIds = new Set(active.map((player) => player.id));
    players.forEach((player) => {
      if (!activeIds.has(player.id)) sitOutCounts.set(player.id, sitOutCounts.get(player.id) + 1);
    });

    const sortedUnits = sortUnitsForBalance(activeUnits, el.balanceStyle.value, roundIndex, seedOffset);
    const groups = buildCourtGroups(sortedUnits, playersPerCourt, courts);
    const matches = [];
    groups.forEach((group, court) => {
      const match = playersPerCourt === 4
        ? makeDoublesMatch(group, partnerCounts, el.avoidRepeats.checked)
        : makeSinglesMatch(group.flatMap((unit) => unit.players));
      if (!match) return;

      if (playersPerCourt === 4) {
        partnerCounts.set(pairKey(match.teamA[0], match.teamA[1]), (partnerCounts.get(pairKey(match.teamA[0], match.teamA[1])) || 0) + 1);
        partnerCounts.set(pairKey(match.teamB[0], match.teamB[1]), (partnerCounts.get(pairKey(match.teamB[0], match.teamB[1])) || 0) + 1);
      }

      matches.push({ court: court + 1, ...match });
    });

    const sitOuts = players.filter((player) => !activeIds.has(player.id));
    schedule.push({ round: roundIndex + 1, matches, sitOuts });
  }

  return { schedule, players, courts, rounds, warnings: fixedPairsResult.warnings };
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function renderSchedule(result) {
  if (result.error) {
    lastSchedule = null;
    el.schedule.className = "schedule";
    el.schedule.innerHTML = `<div class="warning">${escapeHtml(result.error)}</div>`;
    el.statusText.textContent = "More players needed.";
    el.copyBtn.disabled = true;
    el.downloadBtn.disabled = true;
    return;
  }

  lastSchedule = result.schedule;
  const totalMatches = result.schedule.reduce((sum, round) => sum + round.matches.length, 0);
  el.statusText.textContent = `${totalMatches} matches across ${result.rounds} round${result.rounds === 1 ? "" : "s"}.${result.warnings?.length ? ` ${result.warnings.length} fixed-pair note${result.warnings.length === 1 ? "" : "s"}.` : ""}`;
  el.copyBtn.disabled = false;
  el.downloadBtn.disabled = false;
  el.schedule.className = "schedule";
  el.schedule.innerHTML = `${result.warnings?.length ? `<div class="note">${result.warnings.map((warning) => escapeHtml(warning)).join("<br>")}</div>` : ""}${result.schedule
    .map((round) => `
      <section class="round">
        <div class="roundTitle">
          <h3>Round ${round.round}</h3>
          <span class="sitOuts">${round.sitOuts.length ? `Sitting out: ${round.sitOuts.map((player) => escapeHtml(player.name)).join(", ")}` : "Everyone plays"}</span>
        </div>
        <div class="matchGrid">
          ${round.matches.map(renderMatch).join("")}
        </div>
      </section>
    `)
    .join("")}`;
}

function renderMatch(match) {
  return `
    <article class="match">
      <div class="courtLabel">Court ${match.court}</div>
      <div class="teams">
        <div class="team">
          <span class="teamName">Team A</span>
          <span class="players">${match.teamA.map((player) => escapeHtml(player.name)).join(" / ")}</span>
        </div>
        <div class="team">
          <span class="teamName">Team B</span>
          <span class="players">${match.teamB.map((player) => escapeHtml(player.name)).join(" / ")}</span>
        </div>
      </div>
    </article>
  `;
}

function scheduleToCsv(schedule) {
  const rows = [["Round", "Court", "Team A Player 1", "Team A Player 2", "Team B Player 1", "Team B Player 2", "Sit Outs"]];
  schedule.forEach((round) => {
    round.matches.forEach((match, index) => {
      rows.push([
        round.round,
        match.court,
        match.teamA[0]?.name || "",
        match.teamA[1]?.name || "",
        match.teamB[0]?.name || "",
        match.teamB[1]?.name || "",
        index === 0 ? round.sitOuts.map((player) => player.name).join("; ") : ""
      ]);
    });
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function downloadCsv() {
  if (!lastSchedule) return;
  const blob = new Blob([scheduleToCsv(lastSchedule)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reclub-social-session-matches.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function copyCsv() {
  if (!lastSchedule) return;
  await navigator.clipboard.writeText(scheduleToCsv(lastSchedule));
  el.copyBtn.textContent = "Copied";
  window.setTimeout(() => {
    el.copyBtn.textContent = "Copy";
  }, 1200);
}

function storeSettings() {
  const settings = {
    players: el.playersInput.value,
    fixedPairs: el.fixedPairsInput.value,
    courts: el.courtCount.value,
    rounds: el.roundCount.value,
    playersPerCourt: el.playersPerCourt.value,
    balanceStyle: el.balanceStyle.value,
    avoidRepeats: el.avoidRepeats.checked,
    rotateSits: el.rotateSits.checked
  };
  localStorage.setItem("ticklePickleSettings", JSON.stringify(settings));
}

function restoreSettings() {
  const raw = localStorage.getItem("ticklePickleSettings");
  if (!raw) return;
  try {
    const settings = JSON.parse(raw);
    el.playersInput.value = settings.players || "";
    el.fixedPairsInput.value = settings.fixedPairs || "";
    el.courtCount.value = settings.courts || "3";
    el.roundCount.value = settings.rounds || "4";
    el.playersPerCourt.value = settings.playersPerCourt || "4";
    el.balanceStyle.value = settings.balanceStyle || "social";
    el.avoidRepeats.checked = settings.avoidRepeats !== false;
    el.rotateSits.checked = settings.rotateSits !== false;
  } catch {
    localStorage.removeItem("ticklePickleSettings");
  }
}

function attachEvents() {
  const inputs = [
    el.playersInput,
    el.fixedPairsInput,
    el.courtCount,
    el.roundCount,
    el.playersPerCourt,
    el.balanceStyle,
    el.avoidRepeats,
    el.rotateSits
  ];
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      updateSummary();
      storeSettings();
    });
  });
  el.generateBtn.addEventListener("click", () => {
    generationCount += 1;
    renderSchedule(generateSchedule());
  });
  el.downloadBtn.addEventListener("click", downloadCsv);
  el.copyBtn.addEventListener("click", copyCsv);
  el.loadSample.addEventListener("click", () => {
    el.playersInput.value = samplePlayers.join("\n");
    el.fixedPairsInput.value = sampleFixedPairs.join("\n");
    updateSummary();
    storeSettings();
    generationCount += 1;
    renderSchedule(generateSchedule());
  });
}

restoreSettings();
attachEvents();
updateSummary();
