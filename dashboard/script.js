/* YAADVAAN - dashboard prototype */
const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
let currentStep = 1;
let familyChoice = false;
let capturedFace = null;
let registerStream = null;
let loginStream = null;
let faceModelsLoaded = false;
let loginChecking = false;

function $(id) { return document.getElementById(id); }

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
  const page = $(pageId);
  if (page) page.classList.remove("hidden");
}

function getNextPatientId() {
  const counter = Number(localStorage.getItem("patientCounter") || "0") + 1;
  return `YAD${String(counter).padStart(4, "0")}`;
}

function updatePatientIdPreview() {
  const id = getNextPatientId();
  if ($("patient-id-preview")) $("patient-id-preview").textContent = id;
  if ($("caregiver-username")) {
    $("caregiver-username").value = id;
    $("caregiver-username").readOnly = true;
  }
}

function chooseRole(role) {
  const patient = JSON.parse(localStorage.getItem("patient") || "null");
  const caregiver = JSON.parse(localStorage.getItem("caregiver") || "null");

  if (role === "caregiver") {
    if (patient && caregiver) {
      showPage("caregiver-login-page");
    } else {
      showSetupPage();
    }
    return;
  }

  if (!patient || !patient.faceDescriptor) {
    alert("A caregiver must register the patient first. Please complete caregiver and patient registration before using the patient login.");
    showSetupPage();
    return;
  }

  $("patient-login-welcome").textContent = `Welcome, ${patient.name}. Verifying automatically...`;
  showPage("patient-login-page");
  startLoginCamera().then(() => recognizePatient());
}

function showSetupPage() {
  currentStep = 1;
  capturedFace = null;
  familyChoice = false;
  stopRegistrationCamera();
  document.querySelectorAll(".setup-step").forEach(step => step.classList.add("hidden"));
  $("step-1").classList.remove("hidden");
  $("current-step").textContent = "1";
  $("family-form").classList.add("hidden");
  $("setup-status").textContent = "";
  $("face-status").textContent = "";
  updatePatientIdPreview();
  showPage("setup-page");
}

function nextStep(step) {
  if (step === 2 && !validateCaregiver()) return;
  if (step === 3 && !validatePatientDetails()) return;
  if (step === 4 && !capturedFace) {
    alert("Please register the patient's face before continuing.");
    return;
  }

  document.querySelectorAll(".setup-step").forEach(item => item.classList.add("hidden"));
  const next = $(`step-${step}`);
  if (next) next.classList.remove("hidden");
  currentStep = step;
  $("current-step").textContent = String(step);

  if (step === 3) startRegistrationCamera();
}

function validateCaregiver() {
  const fields = [
    ["caregiver-name", "Please enter the caregiver name."],
    ["caregiver-dob", "Please select the caregiver date of birth."],
    ["caregiver-email", "Please enter the caregiver email."],
    ["caregiver-phone", "Please enter the caregiver phone number."],
    ["caregiver-password", "Please create a password."]
  ];
  for (const [id, message] of fields) {
    if (!$(id).value.trim()) { alert(message); $(id).focus(); return false; }
  }
  return true;
}

function validatePatientDetails() {
  const fields = [
    ["patient-name", "Please enter the patient name."],
    ["patient-dob", "Please select the patient date of birth."],
    ["patient-language", "Please select the patient's language."]
  ];
  for (const [id, message] of fields) {
    if (!$(id).value.trim()) { alert(message); $(id).focus(); return false; }
  }
  return true;
}

async function loadFaceModels() {
  if (faceModelsLoaded) return true;
  try {
    if ($("face-status")) $("face-status").textContent = "Loading face-recognition models...";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    faceModelsLoaded = true;
    return true;
  } catch (error) {
    console.error(error);
    if ($("face-status")) $("face-status").textContent = "Face-recognition models could not be loaded.";
    return false;
  }
}

async function startRegistrationCamera() {
  try {
    stopRegistrationCamera();
    registerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    const video = $("register-video");
    video.srcObject = registerStream;
    await video.play();
    $("face-status").textContent = "Camera ready. Only the patient should be visible.";
  } catch (error) {
    console.error(error);
    $("face-status").textContent = "Camera permission was denied or the camera is unavailable.";
  }
}

function stopRegistrationCamera() {
  if (registerStream) registerStream.getTracks().forEach(track => track.stop());
  registerStream = null;
}

async function captureFace() {
  if (!registerStream) { alert("Please wait for the camera to start."); return; }
  if (!(await loadFaceModels())) return;
  const video = $("register-video");
  const status = $("face-status");
  status.textContent = "Hold still. Capturing your face...";

  try {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }))
        .withFaceLandmarks().withFaceDescriptors();
      if (detections.length === 0) { status.textContent = "No face detected. Look directly at the camera."; return; }
      if (detections.length > 1) { status.textContent = "More than one face detected. Only the patient should be visible."; return; }
      samples.push(Array.from(detections[0].descriptor));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    capturedFace = samples[0].map((_, index) => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length);
    status.textContent = "✓ Patient face registered successfully.";
    stopRegistrationCamera();
  } catch (error) {
    console.error(error);
    status.textContent = "Could not register the face. Please try again.";
  }
}

function setFamilyChoice(choice) {
  familyChoice = choice;
  $("family-form").classList.toggle("hidden", !choice);
  if (!choice) {
    $("family-name").value = "";
    $("family-relationship").value = "";
    $("family-phone").value = "";
  }
}

function finishSetup() {
  if (!$("care-guide-read").checked) {
    $("setup-status").textContent = "Please read the caregiver guidance and tick the confirmation box.";
    return;
  }
  if (!capturedFace) {
    $("setup-status").textContent = "Please register the patient's face before continuing.";
    return;
  }
  if (familyChoice && (!["family-name", "family-relationship", "family-phone"].every(id => $(id).value.trim()))) {
    $("setup-status").textContent = "Please complete all family member details.";
    return;
  }

  const patientId = getNextPatientId();
  const caregiver = {
    name: $("caregiver-name").value.trim(), dob: $("caregiver-dob").value,
    email: $("caregiver-email").value.trim(), phone: $("caregiver-phone").value.trim(),
    username: patientId, password: $("caregiver-password").value
  };
  const patient = {
    id: patientId, name: $("patient-name").value.trim(), dob: $("patient-dob").value,
    email: $("patient-email").value.trim(), language: $("patient-language").value,
    faceDescriptor: capturedFace, lastActive: "Not recorded", sessionDuration: "Not recorded", gamesCompleted: 0
  };
  const familyMember = familyChoice ? {
    name: $("family-name").value.trim(), relationship: $("family-relationship").value.trim(), phone: $("family-phone").value.trim()
  } : null;

  localStorage.setItem("caregiver", JSON.stringify(caregiver));
  localStorage.setItem("patient", JSON.stringify(patient));
  localStorage.setItem("familyMember", JSON.stringify(familyMember));
  localStorage.setItem("patientCounter", String(Number(localStorage.getItem("patientCounter") || "0") + 1));
  localStorage.setItem("careGuideRead", "true");

  stopRegistrationCamera();
  alert(`Registration completed. Patient ID: ${patientId}`);
  showPage("role-page");
  $("role-status").textContent = "Registration completed. Choose Patient or Caregiver.";
}

function loginCaregiver() {
  const caregiver = JSON.parse(localStorage.getItem("caregiver") || "null");
  const patient = JSON.parse(localStorage.getItem("patient") || "null");

  if (!caregiver || !patient) {
    $("caregiver-login-status").textContent = "Please register first.";
    return;
  }

  const enteredUsername = $("login-username").value.trim().toUpperCase();
  const enteredPassword = $("login-password").value;

  const savedUsername = String(caregiver.username || "").trim().toUpperCase();
  const savedPassword = String(caregiver.password || "");

  console.log("Entered username:", enteredUsername);
  console.log("Saved username:", savedUsername);
  console.log("Password matches:", enteredPassword === savedPassword);

  if (enteredUsername !== savedUsername || enteredPassword !== savedPassword) {
    $("caregiver-login-status").textContent =
      "Incorrect patient ID or password.";
    return;
  }

  $("caregiver-login-status").textContent = "Login successful.";
  loadCaregiverDashboard();
}

async function startLoginCamera() {
  try {
    stopLoginCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      $("login-status").textContent =
        "Camera access is unavailable. Open the app using localhost or HTTPS.";
      return false;
    }

    loginStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    const video = $("login-video");
    video.srcObject = loginStream;
    video.muted = true;
    video.playsInline = true;

    await new Promise(resolve => {
      if (video.readyState >= 2) resolve();
      else video.onloadedmetadata = resolve;
    });

    await video.play();

    // Give the camera time to produce a clear frame.
    await new Promise(resolve => setTimeout(resolve, 1500));

    $("login-status").textContent =
      "Camera ready. Look directly at the camera.";
    return true;

  } catch (error) {
    console.error("Camera error:", error);
    $("login-status").textContent =
      "Camera permission was denied or the camera is unavailable.";
    return false;
  }
}
function stopLoginCamera() {
  if (loginStream) loginStream.getTracks().forEach(track => track.stop());
  loginStream = null;
}

async function recognizePatient() {
  if (loginChecking || !loginStream) return;

  const patient = JSON.parse(localStorage.getItem("patient") || "null");

  if (!patient || !patient.faceDescriptor) {
    $("login-status").textContent =
      "No registered patient face found.";
    return;
  }

  loginChecking = true;

  try {
    if (!(await loadFaceModels())) return;

    const video = $("login-video");
    const status = $("login-status");

    status.textContent = "Look directly at the camera. Hold still...";

    let detection = null;

    // Try for up to 10 seconds instead of only 1.25 seconds.
    for (let attempt = 0; attempt < 20; attempt++) {
      const results = await faceapi
        .detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.35
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (results.length > 1) {
        status.textContent =
          "Only the patient should be visible.";
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      if (results.length === 1) {
        detection = results[0];
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!detection) {
      status.textContent =
        "No face detected. Move closer, improve lighting, and try again.";
      return;
    }

    const matcher = new faceapi.FaceMatcher(
      [
        new faceapi.LabeledFaceDescriptors(
          "patient",
          [new Float32Array(patient.faceDescriptor)]
        )
      ],
      0.6
    );

    const match = matcher.findBestMatch(detection.descriptor);

    console.log("Face distance:", match.distance);

    if (match.label === "unknown") {
      status.textContent =
        "Patient not recognized. Please try again in good lighting.";
      return;
    }

    patient.lastActive = new Date().toLocaleString();
    localStorage.setItem("patient", JSON.stringify(patient));

    $("login-status").textContent = "✓ Patient recognized.";
stopLoginCamera();
setTimeout(openTodaysGame, 500);
setTimeout(() => {
  launchDailyGame();
}, 500);

  } catch (error) {
    console.error("Face verification error:", error);
    $("login-status").textContent =
      "Face verification failed. Please try again.";
  } finally {
    loginChecking = false;
  }
}

function openGame(game) {
  const target = game === "numbers" ? "numbers.html" : "sih.html";
  window.location.href = target;
}
function openTodaysGame() {
  const today = new Date().toISOString().slice(0, 10);
  const saved = JSON.parse(localStorage.getItem("dailyGame") || "null");

  let game;

  // Same game for the whole day
  if (saved && saved.date === today) {
    game = saved.game;
  } else {
    game = Math.random() < 0.5 ? "numbers" : "memory";
    localStorage.setItem("dailyGame", JSON.stringify({
      date: today,
      game: game
    }));
  }

  const gamePath = game === "numbers"
    ? "games/numbers.html"
    : "games/memory match/sih.html";

  window.location.href = gamePath;
}
function getGameResults() {
  return JSON.parse(localStorage.getItem("gameResults") || "[]");
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === "") return "—";
  const n = Number(seconds);
  return Number.isFinite(n) ? `${Math.floor(n / 60)}m ${n % 60}s` : String(seconds);
}

function renderGameAnalytics() {
  const results = getGameResults();
  const today = new Date().toDateString();
  const todayResults = results.filter(r => new Date(r.timestamp).toDateString() === today);
  const total = results.length;
  const avgAccuracy = total ? Math.round(results.reduce((a,r) => a + Number(r.accuracy || 0), 0) / total) : 0;
  const avgTime = total ? Math.round(results.reduce((a,r) => a + Number(r.timeTaken || 0), 0) / total) : 0;
  const byGame = {};
  results.forEach(r => { byGame[r.gameName] = byGame[r.gameName] || []; byGame[r.gameName].push(r); });
  $("today-session-content").innerHTML = todayResults.length ? `<ul class="analytics-list">${todayResults.map(r => `<li><strong>${r.gameName}</strong> — ${r.completed ? "Completed" : "Stopped/attempted"}; score ${r.score ?? "—"}; accuracy ${r.accuracy ?? 0}%; time ${formatDuration(r.timeTaken)}</li>`).join("")}</ul>` : "No games played today.";
  $("cognitive-results").innerHTML = `<li>Memory: ${byGame["Memory Match"] ? `${byGame["Memory Match"].length} session(s), latest accuracy ${byGame["Memory Match"].at(-1).accuracy}%` : "No results yet"}</li><li>Attention: ${byGame["Memory Trail"] ? `${byGame["Memory Trail"].length} session(s), latest accuracy ${byGame["Memory Trail"].at(-1).accuracy}%` : "No results yet"}</li><li>Executive function: Based on mistakes and completion consistency — ${total ? `${results.filter(r => r.completed).length}/${total} sessions completed` : "No results yet"}</li><li>Language: Game instructions used — Assamese/English where available</li><li>Visuospatial: ${byGame["Memory Match"] ? "Picture matching activity recorded" : "No results yet"}</li>`;
  $("progress-results").innerHTML = total ? `<p><strong>${total}</strong> total session(s). Average accuracy: <strong>${avgAccuracy}%</strong>. Average duration: <strong>${formatDuration(avgTime)}</strong>.</p><ul class="analytics-list">${results.slice(-5).reverse().map(r => `<li>${new Date(r.timestamp).toLocaleString()} — ${r.gameName}: ${r.accuracy}% accuracy, ${formatDuration(r.timeTaken)}</li>`).join("")}</ul>` : "No progress recorded yet.";
  const observations = results.filter(r => !r.completed || Number(r.mistakes || 0) >= 3 || Number(r.moves || 0) > Number(r.pairs || 0) * 3).slice(-5).reverse();
  $("observations-results").innerHTML = total ? `<ul class="analytics-list">${observations.map(r => `<li>${r.gameName}: ${r.completed ? "Repeated mistakes or extra moves" : "Session ended before completion"}.</li>`).join("") || "<li>No difficulty observations yet.</li>"}</ul>` : "No observations recorded yet.";
}

function loadCaregiverDashboard() {
  const caregiver = JSON.parse(localStorage.getItem("caregiver") || "null");
  const patient = JSON.parse(localStorage.getItem("patient") || "null");

  if (!caregiver || !patient) {
    showPage("role-page");
    return;
  }

  $("dashboard-welcome").textContent = `Welcome, ${caregiver.name}.`;
  $("overview-name").textContent = patient.name;
  $("overview-id").textContent = patient.id;
  $("overview-last-active").textContent = patient.lastActive || "Not recorded";
  $("overview-duration").textContent = patient.sessionDuration || "Not recorded";
  $("overview-games").textContent = patient.gamesCompleted || "0";

  loadWellbeing();
  updateCaregiverAnalytics();

  showPage("caregiver-dashboard-page");
}
function updateCaregiverAnalytics() {
  const patient = JSON.parse(localStorage.getItem("patient") || "null");
  const wellbeing = JSON.parse(localStorage.getItem("wellbeing") || "null");
  const gameResults = JSON.parse(localStorage.getItem("gameResults") || "[]");

  if (!patient) return;

  const today = new Date().toISOString().slice(0, 10);
  const todayResults = gameResults.filter(result => result.date === today);

  // 1. Today's Session
  const todayPanel = $("today-panel");

  if (todayResults.length === 0) {
    todayPanel.innerHTML = "<p>No games completed today.</p>";
  } else {
    todayPanel.innerHTML = todayResults.map(result => `
      <p>
        <strong>${result.gameName || "Game"}</strong><br>
        Score: ${result.score ?? "Not recorded"}<br>
        Accuracy: ${result.accuracy ?? "Not recorded"}<br>
        Time: ${result.duration ?? "Not recorded"}<br>
        Status: ${result.completed ? "Completed" : "Incomplete"}
      </p>
    `).join("");
  }

  // 2. Cognitive Areas
  const cognitivePanel = $("cognitive-panel");

  const memoryResults = gameResults.filter(r => r.gameName === "Memory Match");
  const numbersResults = gameResults.filter(r => r.gameName === "Numbers");

  cognitivePanel.innerHTML = `
    <ul>
      <li>Memory: ${memoryResults.length ? "Results available" : "No results yet"}</li>
      <li>Attention: ${numbersResults.length ? "Results available" : "No results yet"}</li>
      <li>Executive function: ${numbersResults.length ? "Results available" : "No results yet"}</li>
      <li>Language: No results yet</li>
      <li>Visuospatial: ${memoryResults.length ? "Results available" : "No results yet"}</li>
    </ul>
  `;

  // 3. Progress Over Time
  $("progress-panel").innerHTML = `
    <p>Total sessions: ${gameResults.length}</p>
    <p>Games completed: ${patient.gamesCompleted || 0}</p>
    <p>Last active: ${patient.lastActive || "Not recorded"}</p>
  `;

  // 4. Recent Observations
  $("observations-panel").innerHTML = `
    <p>Incomplete games: ${gameResults.filter(r => !r.completed).length}</p>
    <p>Recent games: ${gameResults.length}</p>
  `;

  // 5. Medicine Tracking
  const medicinePanel = document.querySelector("#medicine-taken");

  if (medicinePanel) {
    medicinePanel.checked = Boolean(wellbeing?.medicineTaken);
  }

  const medicineNotes = $("medicine-notes");
  if (medicineNotes) {
    medicineNotes.value = wellbeing?.medicineNotes || "";
  }
}
function getGuidelines(language) {
  const guides = {
    Assamese: ["ঔষধ সময়মতে লওক।", "পানী আৰু স্বাস্থ্যকৰ খাদ্য গ্ৰহণ কৰক।", "দৈনিক অলপ সময় খোজ কাঢ়ক।"],
    Bengali: ["সময়মতো ওষুধ নিন।", "পানি ও স্বাস্থ্যকর খাবার খান।", "প্রতিদিন অল্প সময় হাঁটুন।"],
    Bodo: ["समायआव औषधि लानाय।", "फिसा आरो हेंथा जानाय।", "सानसे खौसे जानाय।"],
    Khasi: ["Bam dawai ha ka por kaba biang.", "Dih um bad bam ka jingbam kaba koit.", "Leit iaid paidbah man ka sngi."],
    Manipuri: ["মরুপ মতমদা ঔষধ লৌবিয়ু।", "ঈশিং অমসুং ফজরবা চাক চাউ।", "নুমিদাং খরা থাজবা থৌদাং শেমজ।"],
    Mizo: ["Damdawi hunah la duh lovin i la.", "Tui in a in, ei tha tak ei.", "Ni tinah hun te kal rawh."],
    Nepali: ["समयमा औषधि लिनुहोस्।", "पानी र स्वस्थ खाना खानुहोस्।", "हरेक दिन केही समय हिँड्नुहोस्।"],
    Tripuri: ["समयनो औषधि खा।", "पानी आरो भालो खाबार खा।", "दिनो खोनो समाय हाटा।"],
    English: ["Take medicines at the correct time.", "Drink water and eat healthy food.", "Walk or move gently for a few minutes every day."]
  };
  return guides[language] || guides.English;
}

function loadPatientHome() {
  const patient = JSON.parse(localStorage.getItem("patient") || "null");
  if (!patient) return showPage("role-page");
  $("patient-home-title").textContent = `Welcome, ${patient.name}`;
  const list = $("patient-guidelines");
  if (list) list.innerHTML = getGuidelines(patient.language).map(item => `<li>${item}</li>`).join("");
  showPage("patient-home-page");
}

function togglePanel(id) { const panel = $(id); if (panel) panel.classList.toggle("hidden"); }

function saveWellbeing() {
  const value = { medicineTaken: $("medicine-taken").checked, medicineNotes: $("medicine-notes").value, overall: $("wellbeing").value, notes: $("wellbeing-notes").value };
  localStorage.setItem("wellbeing", JSON.stringify(value));
  $("wellbeing-status").textContent = "Saved locally.";
}

function loadWellbeing() {
  const value = JSON.parse(localStorage.getItem("wellbeing") || "null");
  if (!value) return;
  $("medicine-taken").checked = Boolean(value.medicineTaken);
  $("medicine-notes").value = value.medicineNotes || "";
  $("wellbeing").value = value.overall || "";
  $("wellbeing-notes").value = value.notes || "";
}

function logout() { stopLoginCamera(); stopRegistrationCamera(); showPage("role-page"); }

updatePatientIdPreview();
