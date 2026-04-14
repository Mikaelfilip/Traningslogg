const STORAGE_KEY = "trainingLogV1";
const CURRENT_VERSION = 3;

let data = loadData();
let selectedExerciseName = "";
let selectedProgressExercises = new Set();
let saveStatusTimeoutId = 0;

const tabButtons = document.querySelectorAll(".tab-button");
const views = document.querySelectorAll(".view");
const workoutForm = document.querySelector("#workout-form");
const workoutNameInput = document.querySelector("#workout-name");
const workoutExercisesInput = document.querySelector("#workout-exercises");
const workoutList = document.querySelector("#workout-list");
const workoutSelect = document.querySelector("#workout-select");
const logDateInput = document.querySelector("#log-date");
const saveStatus = document.querySelector("#save-status");
const logForm = document.querySelector("#log-form");
const exerciseOptions = document.querySelector("#exercise-options");
const progressSummary = document.querySelector("#progress-summary");
const progressChart = document.querySelector("#progress-chart");
const progressList = document.querySelector("#progress-list");

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function createDefaultData() {
  const workouts = [
    {
      id: createId(),
      name: "Pass A",
      exercises: ["Bänkpress", "Knäböj", "Rodd"]
    },
    {
      id: createId(),
      name: "Pass B",
      exercises: ["Marklyft", "Militärpress", "Latsdrag"]
    }
  ];

  return {
    version: CURRENT_VERSION,
    workouts,
    logs: [],
    uiState: {
      selectedWorkoutId: workouts[0]?.id || "",
      selectedDate: getToday()
    }
  };
}

// Hämtar sparad data och migrerar automatiskt till aktuell version.
function loadData() {
  const fallbackData = createDefaultData();
  const savedData = localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
    return fallbackData;
  }

  try {
    const parsedData = JSON.parse(savedData);
    const normalizedData = normalizeData(parsedData, fallbackData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedData));
    return normalizedData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
    return fallbackData;
  }
}

function normalizeData(rawData, fallbackData) {
  if (!rawData || typeof rawData !== "object") {
    return fallbackData;
  }

  const rawWorkouts = Array.isArray(rawData.workouts) ? rawData.workouts : fallbackData.workouts;
  const workouts = rawWorkouts.map(normalizeWorkout).filter(Boolean);

  const rawLogs = Array.isArray(rawData.logs) ? rawData.logs : [];
  const logs = rawLogs.map(normalizeLog).filter(Boolean);

  const selectedFromStorage = typeof rawData.uiState?.selectedWorkoutId === "string"
    ? rawData.uiState.selectedWorkoutId
    : "";

  const selectedWorkoutId = workouts.some((workout) => workout.id === selectedFromStorage)
    ? selectedFromStorage
    : (workouts[0]?.id || "");
  const selectedDate = normalizeDate(rawData.uiState?.selectedDate);

  return {
    version: CURRENT_VERSION,
    workouts,
    logs,
    uiState: {
      selectedWorkoutId,
      selectedDate
    }
  };
}

function normalizeWorkout(workout) {
  if (!workout || typeof workout !== "object") {
    return null;
  }

  const name = normalizeTextValue(workout.name) || "Pass";
  const exercises = dedupeExerciseNames(Array.isArray(workout.exercises) ? workout.exercises : []);

  return {
    id: normalizeTextValue(workout.id) || createId(),
    name,
    exercises
  };
}

function normalizeLog(log) {
  if (!log || typeof log !== "object") {
    return null;
  }

  const rawResults = Array.isArray(log.results) ? log.results : [];
  const results = rawResults.map(normalizeResult).filter(Boolean);

  if (results.length === 0) {
    return null;
  }

  return {
    date: normalizeDate(log.date),
    workoutId: normalizeTextValue(log.workoutId),
    workoutName: normalizeTextValue(log.workoutName),
    results
  };
}

function normalizeResult(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const exercise = normalizeTextValue(result.exercise);
  const weight = normalizeTextValue(result.weight);
  const reps = normalizeTextValue(result.reps);
  const sets = normalizeTextValue(result.sets) || "1";

  if (!exercise || !weight || !reps) {
    return null;
  }

  return {
    exercise,
    weight,
    reps,
    sets
  };
}

function normalizeDate(dateValue) {
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  return getToday();
}

function normalizeTextValue(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function dedupeExerciseNames(exercises) {
  const seen = new Set();
  const deduped = [];

  exercises.forEach((exercise) => {
    const name = normalizeTextValue(exercise);
    const key = name.toLocaleLowerCase("sv");

    if (!name || seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(name);
  });

  return deduped;
}

function hasExerciseIgnoreCase(workout, exerciseName) {
  const key = normalizeTextValue(exerciseName).toLocaleLowerCase("sv");
  return workout.exercises.some((exercise) => exercise.toLocaleLowerCase("sv") === key);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Lokalt datum i format YYYY-MM-DD (inte UTC).
function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showView(viewName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  views.forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}-view`);
  });
}

function showSaveStatus(message) {
  if (!saveStatus) {
    return;
  }

  window.clearTimeout(saveStatusTimeoutId);
  saveStatus.textContent = message;
  saveStatus.classList.add("visible");

  saveStatusTimeoutId = window.setTimeout(() => {
    saveStatus.classList.remove("visible");
    saveStatus.textContent = "";
  }, 1500);
}

function render() {
  renderWorkouts();
  renderWorkoutSelect();
  renderLogDate();
  renderLogForm();
  renderExerciseOptions();
  renderProgress();
}

function renderLogDate() {
  data.uiState.selectedDate = normalizeDate(data.uiState.selectedDate);
  logDateInput.value = data.uiState.selectedDate;
}

function renderWorkouts() {
  workoutList.innerHTML = "";

  if (data.workouts.length === 0) {
    workoutList.innerHTML = '<p class="empty-state">Du har inget schema än.</p>';
    return;
  }

  data.workouts.forEach((workout) => {
    const card = document.createElement("article");
    card.className = "workout-card";

    const title = document.createElement("h3");
    title.textContent = workout.name;

    const exerciseList = document.createElement("ul");
    exerciseList.className = "exercise-tags";

    workout.exercises.forEach((exercise) => {
      const item = document.createElement("li");

      const exerciseButton = document.createElement("button");
      exerciseButton.className = "exercise-link";
      exerciseButton.type = "button";
      exerciseButton.textContent = exercise;
      exerciseButton.addEventListener("click", () => openExerciseLog(workout.id, exercise));

      item.append(exerciseButton);
      exerciseList.append(item);
    });

    const addExerciseForm = document.createElement("form");
    addExerciseForm.className = "inline-form";
    addExerciseForm.addEventListener("submit", (event) => addExercise(event, workout.id));

    const addExerciseLabel = document.createElement("label");
    addExerciseLabel.textContent = "Lägg till övning";

    const addExerciseInput = document.createElement("input");
    addExerciseInput.name = "exerciseName";
    addExerciseInput.placeholder = "Till exempel Chins";
    addExerciseInput.type = "text";
    addExerciseInput.required = true;

    const addExerciseButton = document.createElement("button");
    addExerciseButton.type = "submit";
    addExerciseButton.textContent = "Lägg till";

    addExerciseLabel.append(addExerciseInput);
    addExerciseForm.append(addExerciseLabel, addExerciseButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Ta bort pass";
    deleteButton.addEventListener("click", () => deleteWorkout(workout.id));

    card.append(title, exerciseList, addExerciseForm, deleteButton);
    workoutList.append(card);
  });
}

function renderWorkoutSelect() {
  workoutSelect.innerHTML = "";

  if (data.workouts.length === 0) {
    workoutSelect.innerHTML = '<option value="">Skapa ett pass först</option>';

    if (data.uiState.selectedWorkoutId !== "") {
      data.uiState.selectedWorkoutId = "";
      saveData();
    }

    return;
  }

  data.workouts.forEach((workout) => {
    const option = document.createElement("option");
    option.value = workout.id;
    option.textContent = workout.name;
    workoutSelect.append(option);
  });

  const selectedId = data.workouts.some((workout) => workout.id === data.uiState.selectedWorkoutId)
    ? data.uiState.selectedWorkoutId
    : data.workouts[0].id;

  workoutSelect.value = selectedId;

  if (data.uiState.selectedWorkoutId !== selectedId) {
    data.uiState.selectedWorkoutId = selectedId;
    saveData();
  }
}

function getSelectedWorkout() {
  return data.workouts.find((workout) => workout.id === data.uiState.selectedWorkoutId);
}

function getLatestExerciseResult(exerciseName) {
  const exerciseKey = exerciseName.toLocaleLowerCase("sv");

  for (let logIndex = data.logs.length - 1; logIndex >= 0; logIndex -= 1) {
    const log = data.logs[logIndex];

    for (let resultIndex = log.results.length - 1; resultIndex >= 0; resultIndex -= 1) {
      const result = log.results[resultIndex];
      const resultKey = normalizeTextValue(result.exercise).toLocaleLowerCase("sv");

      if (resultKey === exerciseKey) {
        return result;
      }
    }
  }

  return null;
}

function renderLogForm() {
  logForm.innerHTML = "";

  const workout = getSelectedWorkout();

  if (!workout) {
    logForm.innerHTML = '<p class="empty-state">Skapa ett pass i schemafliken först.</p>';
    return;
  }

  if (selectedExerciseName && !hasExerciseIgnoreCase(workout, selectedExerciseName)) {
    selectedExerciseName = "";
  }

  const selectedKey = selectedExerciseName.toLocaleLowerCase("sv");

  workout.exercises.forEach((exercise) => {
    const card = document.createElement("section");
    card.className = "exercise-card";

    const latest = getLatestExerciseResult(exercise);

    const doneLabel = document.createElement("label");
    doneLabel.className = "done-option";

    const doneInput = document.createElement("input");
    doneInput.type = "checkbox";
    doneInput.name = `${exercise}-done`;
    doneInput.checked = exercise.toLocaleLowerCase("sv") === selectedKey;

    const doneText = document.createElement("span");
    doneText.textContent = `${exercise} gjord`;

    doneLabel.append(doneInput, doneText);

    const fields = document.createElement("div");
    fields.className = "exercise-inputs";

    const weightLabel = document.createElement("label");
    weightLabel.textContent = "Vikt";

    const weightInput = document.createElement("input");
    weightInput.inputMode = "decimal";
    weightInput.min = "0";
    weightInput.name = `${exercise}-weight`;
    weightInput.placeholder = "kg";
    weightInput.step = "0.5";
    weightInput.type = "number";
    weightInput.value = latest?.weight ?? "";

    const repsLabel = document.createElement("label");
    repsLabel.textContent = "Reps";

    const repsInput = document.createElement("input");
    repsInput.inputMode = "numeric";
    repsInput.min = "0";
    repsInput.name = `${exercise}-reps`;
    repsInput.placeholder = "antal";
    repsInput.step = "1";
    repsInput.type = "number";
    repsInput.value = latest?.reps ?? "";

    const setsLabel = document.createElement("label");
    setsLabel.textContent = "Sets";

    const setsInput = document.createElement("input");
    setsInput.inputMode = "numeric";
    setsInput.min = "0";
    setsInput.name = `${exercise}-sets`;
    setsInput.placeholder = "antal";
    setsInput.step = "1";
    setsInput.type = "number";
    setsInput.value = latest?.sets ?? "";

    if (exercise.toLocaleLowerCase("sv") === selectedKey) {
      card.classList.add("selected-exercise");
    }

    weightLabel.append(weightInput);
    repsLabel.append(repsInput);
    setsLabel.append(setsInput);
    fields.append(weightLabel, repsLabel, setsLabel);
    card.append(doneLabel, fields);
    logForm.append(card);
  });

  const saveButton = document.createElement("button");
  saveButton.type = "submit";
  saveButton.textContent = "Spara ibockade övningar";
  logForm.append(saveButton);
}

function renderExerciseOptions() {
  const exercises = getAllExercises();
  exerciseOptions.innerHTML = "";

  if (exercises.length === 0) {
    exerciseOptions.innerHTML = '<p class="empty-state">Inga övningar än.</p>';
    selectedProgressExercises = new Set();
    return;
  }

  if (selectedProgressExercises.size === 0) {
    selectedProgressExercises.add(selectedExerciseName || exercises[0]);
  }

  selectedProgressExercises = new Set(
    [...selectedProgressExercises].filter((exercise) => exercises.includes(exercise))
  );

  if (selectedProgressExercises.size === 0) {
    selectedProgressExercises.add(exercises[0]);
  }

  exercises.forEach((exercise) => {
    const label = document.createElement("label");
    label.className = "check-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = exercise;
    checkbox.checked = selectedProgressExercises.has(exercise);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedProgressExercises.add(exercise);
      } else {
        selectedProgressExercises.delete(exercise);
      }

      renderProgress();
    });

    const text = document.createElement("span");
    text.textContent = exercise;

    label.append(checkbox, text);
    exerciseOptions.append(label);
  });
}

function renderProgress() {
  progressSummary.innerHTML = "";
  progressChart.innerHTML = "";
  progressList.innerHTML = "";

  const selectedExercises = [...selectedProgressExercises];

  if (selectedExercises.length === 0) {
    progressSummary.innerHTML = '<p class="empty-state">Välj minst en övning för att se progression.</p>';
    progressChart.innerHTML = '<p class="empty-state">Välj minst en övning för att se diagrammet.</p>';
    progressList.innerHTML = '<p class="empty-state">Logga ett pass för att se progression.</p>';
    return;
  }

  const results = getProgressResults(selectedExercises);
  renderProgressSummary(selectedExercises, results);

  if (results.length === 0) {
    progressChart.innerHTML = '<p class="empty-state">Inga loggade resultat för valda övningar än.</p>';
    progressList.innerHTML = '<p class="empty-state">Inga loggade resultat för valda övningar än.</p>';
    return;
  }

  renderProgressChart(results, selectedExercises);

  results.forEach((result) => {
    const row = document.createElement("article");
    row.className = "result-row";

    const date = document.createElement("strong");
    date.textContent = result.date;

    const numbers = document.createElement("span");
    numbers.textContent = `${result.weight} kg, ${result.reps} reps, ${result.sets} set`;

    const workout = document.createElement("p");
    workout.className = "secondary-text";
    workout.textContent = result.workoutName;

    row.append(date, numbers, workout);
    progressList.append(row);
  });
}

function getProgressResults(selectedExercises) {
  const selectedKeys = new Set(selectedExercises.map((exercise) => exercise.toLocaleLowerCase("sv")));
  const results = [];

  data.logs.forEach((log, logIndex) => {
    const workoutName = normalizeTextValue(log.workoutName);
    const date = normalizeDate(log.date);
    const logResults = Array.isArray(log.results) ? log.results : [];

    logResults.forEach((result, resultIndex) => {
      const exercise = normalizeTextValue(result.exercise);
      const weight = normalizeTextValue(result.weight);
      const reps = normalizeTextValue(result.reps);
      const sets = normalizeTextValue(result.sets) || "1";

      if (!exercise || !weight || !reps) {
        return;
      }

      if (!selectedKeys.has(exercise.toLocaleLowerCase("sv"))) {
        return;
      }

      results.push({
        date,
        workoutName,
        exercise,
        weight,
        reps,
        sets,
        logIndex,
        resultIndex
      });
    });
  });

  return results.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    const logCompare = b.logIndex - a.logIndex;

    if (logCompare !== 0) {
      return logCompare;
    }

    return b.resultIndex - a.resultIndex;
  });
}

function renderProgressSummary(selectedExercises, results) {
  selectedExercises.forEach((exercise) => {
    const exerciseKey = exercise.toLocaleLowerCase("sv");
    const exerciseResults = results.filter(
      (result) => result.exercise.toLocaleLowerCase("sv") === exerciseKey
    );

    const summaryItem = document.createElement("article");
    summaryItem.className = "summary-item";

    const title = document.createElement("h3");
    title.textContent = exercise;

    const latest = exerciseResults[0];
    const latestText = document.createElement("p");
    latestText.className = "secondary-text";
    latestText.textContent = latest
      ? `Senaste: ${latest.weight} kg (${latest.date})`
      : "Senaste: -";

    const highestWeight = getHighestWeight(exerciseResults);
    const highestText = document.createElement("p");
    highestText.className = "secondary-text";
    highestText.textContent = highestWeight === "-"
      ? "Högsta: -"
      : `Högsta: ${highestWeight} kg`;

    summaryItem.append(title, latestText, highestText);
    progressSummary.append(summaryItem);
  });
}

function getHighestWeight(results) {
  let highestWeight = null;

  results.forEach((result) => {
    const value = parseWeightNumber(result.weight);

    if (value === null) {
      return;
    }

    if (highestWeight === null || value > highestWeight) {
      highestWeight = value;
    }
  });

  if (highestWeight === null) {
    return "-";
  }

  return Number.isInteger(highestWeight)
    ? String(highestWeight)
    : String(Number(highestWeight.toFixed(2)));
}

function renderProgressChart(results, selectedExercises) {
  const width = 640;
  const height = 260;
  const padding = 42;
  const colors = ["#216e4e", "#7b3f98", "#b45f06", "#1f6feb", "#a33a3a"];

  const chartResults = results.filter((result) => parseWeightNumber(result.weight) !== null);

  if (chartResults.length === 0) {
    progressChart.innerHTML = '<p class="empty-state">Inga giltiga viktvärden att rita i diagrammet.</p>';
    return;
  }

  const scaledResults = chartResults.map((result) => ({
    ...result,
    progress: getScaledProgress(result, chartResults)
  }));
  const dates = [...new Set(scaledResults.map((result) => result.date))].sort();
  const stepX = dates.length > 1 ? (width - padding * 2) / (dates.length - 1) : 0;

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Linjediagram över valda övningar");

  const axis = createSvgElement("path");
  axis.setAttribute("d", `M ${padding} ${padding} V ${height - padding} H ${width - padding}`);
  axis.setAttribute("class", "chart-axis");
  svg.append(axis);

  const yLabel = createSvgElement("text");
  yLabel.setAttribute("x", "10");
  yLabel.setAttribute("y", "18");
  yLabel.textContent = "100";
  svg.append(yLabel);

  const xLabel = createSvgElement("text");
  xLabel.setAttribute("x", String(width / 2));
  xLabel.setAttribute("y", String(height - 8));
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.textContent = "Datum";
  svg.append(xLabel);

  if (dates.length === 1) {
    const onlyDateLabel = createSvgElement("text");
    onlyDateLabel.setAttribute("x", String(width / 2));
    onlyDateLabel.setAttribute("y", String(height - padding + 16));
    onlyDateLabel.setAttribute("text-anchor", "middle");
    onlyDateLabel.textContent = formatDateLabel(dates[0]);
    svg.append(onlyDateLabel);
  } else {
    const firstDateLabel = createSvgElement("text");
    firstDateLabel.setAttribute("x", String(padding));
    firstDateLabel.setAttribute("y", String(height - padding + 16));
    firstDateLabel.setAttribute("text-anchor", "start");
    firstDateLabel.textContent = formatDateLabel(dates[0]);

    const lastDateLabel = createSvgElement("text");
    lastDateLabel.setAttribute("x", String(width - padding));
    lastDateLabel.setAttribute("y", String(height - padding + 16));
    lastDateLabel.setAttribute("text-anchor", "end");
    lastDateLabel.textContent = formatDateLabel(dates[dates.length - 1]);

    svg.append(firstDateLabel, lastDateLabel);
  }

  const zeroLabel = createSvgElement("text");
  zeroLabel.setAttribute("x", "8");
  zeroLabel.setAttribute("y", String(height - padding));
  zeroLabel.textContent = "0";

  const middleLabel = createSvgElement("text");
  middleLabel.setAttribute("x", "8");
  middleLabel.setAttribute("y", String(height / 2 + 4));
  middleLabel.textContent = "50";

  svg.append(zeroLabel, middleLabel);

  selectedExercises.forEach((exercise, index) => {
    const exerciseKey = exercise.toLocaleLowerCase("sv");
    const exerciseResults = scaledResults
      .filter((result) => result.exercise.toLocaleLowerCase("sv") === exerciseKey)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);

        if (dateCompare !== 0) {
          return dateCompare;
        }

        const logCompare = a.logIndex - b.logIndex;

        if (logCompare !== 0) {
          return logCompare;
        }

        return a.resultIndex - b.resultIndex;
      });

    if (exerciseResults.length === 0) {
      return;
    }

    const points = exerciseResults
      .map((result) => {
        const dateIndex = dates.indexOf(result.date);

        if (dateIndex < 0) {
          return null;
        }

        const x = dates.length === 1 ? width / 2 : padding + dateIndex * stepX;
        const y = height - padding - (result.progress / 100) * (height - padding * 2);
        return { x, y };
      })
      .filter(Boolean);

    if (points.length === 0) {
      return;
    }

    if (points.length > 1) {
      const line = createSvgElement("polyline");
      line.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", colors[index % colors.length]);
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      svg.append(line);
    }

    points.forEach((point) => {
      const dot = createSvgElement("circle");
      dot.setAttribute("cx", point.x);
      dot.setAttribute("cy", point.y);
      dot.setAttribute("r", "5");
      dot.setAttribute("fill", colors[index % colors.length]);
      svg.append(dot);
    });
  });

  const legend = document.createElement("div");
  legend.className = "chart-legend";

  selectedExercises.forEach((exercise, index) => {
    const item = document.createElement("span");
    item.style.setProperty("--legend-color", colors[index % colors.length]);
    item.textContent = exercise;
    legend.append(item);
  });

  progressChart.append(svg, legend);
}

function getScaledProgress(result, allResults) {
  const exerciseKey = result.exercise.toLocaleLowerCase("sv");
  const weight = parseWeightNumber(result.weight);

  if (weight === null) {
    return 0;
  }

  const exerciseWeights = allResults
    .filter((item) => item.exercise.toLocaleLowerCase("sv") === exerciseKey)
    .map((item) => parseWeightNumber(item.weight))
    .filter((value) => value !== null);

  const minWeight = Math.min(...exerciseWeights);
  const maxWeight = Math.max(...exerciseWeights);

  if (minWeight === maxWeight) {
    return 100;
  }

  return ((weight - minWeight) / (maxWeight - minWeight)) * 100;
}

function formatDateLabel(dateText) {
  const parts = dateText.split("-");

  if (parts.length !== 3) {
    return dateText;
  }

  return `${parts[1]}-${parts[2]}`;
}

function parseWeightNumber(value) {
  const normalized = normalizeTextValue(value).replace(",", ".");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function createSvgElement(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function getAllExercises() {
  const byName = new Map();

  data.workouts.forEach((workout) => {
    workout.exercises.forEach((exercise) => {
      const key = exercise.toLocaleLowerCase("sv");

      if (!byName.has(key)) {
        byName.set(key, exercise);
      }
    });
  });

  return [...byName.values()].sort((a, b) => a.localeCompare(b, "sv"));
}

function addWorkout(event) {
  event.preventDefault();

  const name = normalizeTextValue(workoutNameInput.value);
  const exercises = dedupeExerciseNames(workoutExercisesInput.value.split(","));

  if (!name || exercises.length === 0) {
    return;
  }

  const workout = {
    id: createId(),
    name,
    exercises
  };

  data.workouts.push(workout);

  if (!data.uiState.selectedWorkoutId) {
    data.uiState.selectedWorkoutId = workout.id;
  }

  workoutForm.reset();
  saveData();
  render();
}

function addExercise(event, workoutId) {
  event.preventDefault();

  const form = event.currentTarget;
  const input = form.elements.exerciseName;
  const exerciseName = normalizeTextValue(input.value);
  const workout = data.workouts.find((item) => item.id === workoutId);

  if (!exerciseName || !workout || hasExerciseIgnoreCase(workout, exerciseName)) {
    return;
  }

  workout.exercises.push(exerciseName);
  input.value = "";
  saveData();
  render();
}

function deleteWorkout(workoutId) {
  data.workouts = data.workouts.filter((workout) => workout.id !== workoutId);

  if (!data.workouts.some((workout) => workout.id === data.uiState.selectedWorkoutId)) {
    data.uiState.selectedWorkoutId = data.workouts[0]?.id || "";
  }

  saveData();
  render();
}

function openExerciseLog(workoutId, exerciseName) {
  selectedExerciseName = exerciseName;

  if (data.uiState.selectedWorkoutId !== workoutId) {
    data.uiState.selectedWorkoutId = workoutId;
    saveData();
  }

  renderWorkoutSelect();
  renderLogForm();
  showView("log");
  focusSelectedExerciseInput();
}

function focusSelectedExerciseInput() {
  const selectedCard = logForm.querySelector(".selected-exercise");

  if (!selectedCard) {
    return;
  }

  selectedCard.scrollIntoView({ behavior: "smooth", block: "center" });
  selectedCard.querySelector('input[type="number"]')?.focus();
}

function saveWorkoutLog(event) {
  event.preventDefault();

  const workout = getSelectedWorkout();

  if (!workout) {
    return;
  }

  const selectedDate = normalizeDate(logDateInput.value);

  // Bara ibockade övningar där vikt, reps och sets är ifyllda sparas i loggen.
  const results = workout.exercises
    .map((exercise) => {
      const done = Boolean(logForm.elements[`${exercise}-done`]?.checked);
      const weight = normalizeTextValue(logForm.elements[`${exercise}-weight`]?.value);
      const reps = normalizeTextValue(logForm.elements[`${exercise}-reps`]?.value);
      const sets = normalizeTextValue(logForm.elements[`${exercise}-sets`]?.value);

      return {
        done,
        exercise,
        weight,
        reps,
        sets
      };
    })
    .filter((result) => result.done && result.weight && result.reps && result.sets)
    .map(({ done, ...result }) => result);

  if (results.length === 0) {
    return;
  }

  data.logs.push({
    date: selectedDate,
    workoutId: workout.id,
    workoutName: workout.name,
    results
  });

  data.uiState.selectedDate = selectedDate;
  selectedExerciseName = "";
  results.forEach((result) => selectedProgressExercises.add(result.exercise));
  saveData();
  render();
  showView("log");
  showSaveStatus("Sparat");
}

function handleWorkoutSelectChange() {
  data.uiState.selectedWorkoutId = workoutSelect.value;
  selectedExerciseName = "";
  saveData();
  renderLogForm();
}

function handleLogDateChange() {
  data.uiState.selectedDate = normalizeDate(logDateInput.value);
  logDateInput.value = data.uiState.selectedDate;
  saveData();
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

workoutForm.addEventListener("submit", addWorkout);
workoutSelect.addEventListener("change", handleWorkoutSelectChange);
logDateInput.addEventListener("change", handleLogDateChange);
logForm.addEventListener("submit", saveWorkoutLog);

render();
