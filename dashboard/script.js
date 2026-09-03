// ============================================
// MEMORY CARE APP
// ============================================


// ============================================
// GAME DATA
// ============================================

const games = [

    {
        name: "Numbers game",
        file: "games/numbers.html"
    },


];


// ============================================
// VARIABLES
// ============================================

let registerStream = null;

let loginStream = null;

let capturedFace = null;

let currentStep = 1;


// ============================================
// CHECK WHETHER APP HAS ALREADY
// BEEN SET UP
// ============================================

function checkSetup() {

    const caregiver =
        localStorage.getItem("caregiver");

    const patient =
        localStorage.getItem("patient");


    if (caregiver && patient) {

        showLoginPage();

    }

    else {

        showSetupPage();
    }
}


// ============================================
// SHOW SETUP
// ============================================

function showSetupPage() {

    document
        .getElementById("setup-page")
        .classList.remove("hidden");

    document
        .getElementById("login-page")
        .classList.add("hidden");

    document
        .getElementById("game-page")
        .classList.add("hidden");
}


// ============================================
// SHOW LOGIN
// ============================================

function showLoginPage() {

    document
        .getElementById("setup-page")
        .classList.add("hidden");

    document
        .getElementById("login-page")
        .classList.remove("hidden");

    document
        .getElementById("game-page")
        .classList.add("hidden");


    const patient =
        JSON.parse(
            localStorage.getItem("patient")
        );


    document.getElementById("welcome-text").textContent =
        `Welcome, ${patient.name}. Please look at the camera.`;
}


// ============================================
// MOVE BETWEEN SETUP STEPS
// ============================================

function nextStep(step) {

    // Validate current step
    if (step === 2 && !validateCaregiver()) {

        return;
    }


    if (step === 3 && !validatePatient()) {

        return;
    }


    document
        .getElementById(`step-${currentStep}`)
        .classList.add("hidden");


    document
        .getElementById(`step-${step}`)
        .classList.remove("hidden");


    currentStep = step;


    document.getElementById("current-step").textContent =
        step;
}


// ============================================
// VALIDATE CAREGIVER
// ============================================

function validateCaregiver() {

    const name =
        document.getElementById("caregiver-name").value.trim();

    const username =
        document.getElementById("username").value.trim();

    const password =
        document.getElementById("password").value;


    if (!name || !username || !password) {

        alert("Please fill in all caregiver details.");

        return false;
    }


    // Store caregiver details temporarily
    const caregiver = {

        name: name,

        username: username,

        password: password

    };


    localStorage.setItem(
        "caregiverTemp",
        JSON.stringify(caregiver)
    );


    return true;
}


// ============================================
// VALIDATE PATIENT
// ============================================

function validatePatient() {

    const name =
        document.getElementById("patient-name").value.trim();

    const age =
        document.getElementById("patient-age").value;

    const language =
        document.getElementById("patient-language").value;


    if (!name || !age || !language) {

        alert("Please complete the patient details.");

        return false;
    }


    if (!capturedFace) {

        alert("Please register the patient's face.");

        return false;
    }


    return true;
}


// ============================================
// START REGISTRATION CAMERA
// ============================================

async function startRegistrationCamera() {

    try {

        registerStream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: false

            });


        const video =
            document.getElementById("register-video");


        video.srcObject = registerStream;


        document.getElementById("face-status").textContent =
            "Camera started. Look directly at the camera.";


    }

    catch (error) {

        console.error(error);

        document.getElementById("face-status").textContent =
            "Unable to access the camera.";
    }
}


// ============================================
// CAPTURE PATIENT FACE
// ============================================

function captureFace() {

    const video =
        document.getElementById("register-video");

    const canvas =
        document.getElementById("register-canvas");


    if (!registerStream) {

        alert("Please start the camera first.");

        return;
    }


    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;


    const context =
        canvas.getContext("2d");


    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Convert captured frame into an image
    capturedFace =
        canvas.toDataURL("image/jpeg");


    document.getElementById("face-status").textContent =
        "✓ Face registered successfully.";


    // Stop camera
    registerStream
        .getTracks()
        .forEach(track => track.stop());

    registerStream = null;
}


// ============================================
// ADD FAMILY MEMBER
// ============================================

function addFamilyMember() {

    const familyList =
        document.getElementById("family-list");


    const member =
        document.createElement("div");


    member.classList.add("family-member");


    member.innerHTML = `

        <input
            type="text"
            placeholder="Family Member Name"
            class="family-name"
        >

        <input
            type="text"
            placeholder="Relationship"
            class="family-relation"
        >

    `;


    familyList.appendChild(member);
}


// ============================================
// FINISH FIRST-TIME SETUP
// ============================================

function finishSetup() {

    const familyNames =
        document.querySelectorAll(".family-name");

    const relationships =
        document.querySelectorAll(".family-relation");


    const familyMembers = [];


    for (let i = 0; i < familyNames.length; i++) {

        const name =
            familyNames[i].value.trim();

        const relation =
            relationships[i].value.trim();


        // First family member is mandatory
        if (i === 0 && (!name || !relation)) {

            alert(
                "Please add at least one family member."
            );

            return;
        }


        // Additional members are optional
        if (name && relation) {

            familyMembers.push({

                name: name,

                relationship: relation

            });
        }
    }


    const caregiver =
        JSON.parse(
            localStorage.getItem("caregiverTemp")
        );


    const patient = {

        name:
            document
                .getElementById("patient-name")
                .value.trim(),

        age:
            document
                .getElementById("patient-age")
                .value,

        language:
            document
                .getElementById("patient-language")
                .value,

        // Prototype only
        face:
            capturedFace

    };


    // Save data
    localStorage.setItem(
        "caregiver",
        JSON.stringify(caregiver)
    );


    localStorage.setItem(
        "patient",
        JSON.stringify(patient)
    );


    localStorage.setItem(
        "familyMembers",
        JSON.stringify(familyMembers)
    );


    // Remove temporary data
    localStorage.removeItem("caregiverTemp");


    alert(
        "Setup completed successfully!"
    );


    showLoginPage();
}


// ============================================
// START LOGIN CAMERA
// ============================================

async function startLoginCamera() {

    try {

        loginStream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: false

            });


        const video =
            document.getElementById("login-video");


        video.srcObject = loginStream;


        document.getElementById("login-status").textContent =
            "Camera ready. Look at the camera.";

    }

    catch (error) {

        console.error(error);

        document.getElementById("login-status").textContent =
            "Unable to access the camera.";
    }
}


// ============================================
// RECOGNIZE PATIENT
// ============================================

function recognizePatient() {

    if (!loginStream) {

        alert("Please start the camera first.");

        return;
    }


    const video =
        document.getElementById("login-video");

    const canvas =
        document.getElementById("login-canvas");


    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;


    const context =
        canvas.getContext("2d");


    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        ---------------------------------------
        DEMO FACE AUTHENTICATION
        ---------------------------------------

        This prototype assumes the person
        looking at the camera is the registered
        patient.

        A real application should replace this
        section with an actual face-recognition
        model/service.

        DO NOT use this prototype method for
        real medical/security authentication.
    */


    const registeredFace =
        localStorage.getItem("patient");


    if (registeredFace) {

        document.getElementById("login-status").textContent =
            "✓ Patient recognized.";

        stopLoginCamera();


        setTimeout(() => {

            openDailyGame();

        }, 700);

    }

    else {

        document.getElementById("login-status").textContent =
            "Patient not recognized.";

    }
}


// ============================================
// STOP LOGIN CAMERA
// ============================================

function stopLoginCamera() {

    if (!loginStream) {
        return;
    }


    loginStream
        .getTracks()
        .forEach(track => track.stop());


    loginStream = null;
}


// ============================================
// SELECT DAILY GAME
// ============================================

function openDailyGame() {

    document
        .getElementById("login-page")
        .classList.add("hidden");


    document
        .getElementById("game-page")
        .classList.remove("hidden");


    if (games.length === 0) {

        document.getElementById("game-message").textContent =
            "No games have been added yet.";

        return;
    }


    // Pick a random game
    const randomIndex =
        Math.floor(
            Math.random() * games.length
        );


    const selectedGame =
        games[randomIndex];


    document.getElementById("game-title").textContent =
        selectedGame.name;


    document.getElementById("game-message").textContent =
        "Today's game is ready!";


    // Open game
    setTimeout(() => {

        window.location.href =
            selectedGame.file;

    }, 1000);
}


// ============================================
// LOGOUT
// ============================================

function logout() {

    stopLoginCamera();

    showLoginPage();
}


// ============================================
// START APP
// ============================================

checkSetup();