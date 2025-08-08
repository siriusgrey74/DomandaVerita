
const semi = ['p', 'c', 'q', 'f'];
const valori = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let selected = [];

const grid = document.getElementById("cardGrid");
const selectedCardsSpan = document.getElementById("selectedCards");
const confirmBtn = document.getElementById("confirmBtn");

// Genera la griglia carte
semi.forEach(seme => {
  valori.forEach(val => {
    const carta = val + seme;
    const btn = document.createElement("div");
    btn.className = "card";
    btn.innerText = carta;
    btn.dataset.card = carta;
    btn.addEventListener("click", () => toggleCarta(carta, btn));
    grid.appendChild(btn);
  });
});

function toggleCarta(carta, btnEl) {
  const index = selected.indexOf(carta);
  if (index !== -1) {
    selected.splice(index, 1);
    btnEl.classList.remove("selected");
  } else {
    if (selected.length >= 8) return;
    selected.push(carta);
    btnEl.classList.add("selected");
  }
  updateSelectedDisplay();
}

function updateSelectedDisplay() {
  selectedCardsSpan.innerText = selected.length ? selected.join(", ") : "—";
  confirmBtn.disabled = selected.length !== 8;
}

// Timer 60 secondi
let timeLeft = 60;
const timerEl = document.getElementById("timeLeft");
const timer = setInterval(() => {
  timeLeft--;
  timerEl.innerText = timeLeft;
  if (timeLeft <= 0) {
    clearInterval(timer);
    confirmBtn.disabled = true;
    alert("Tempo scaduto. Le carte verranno completate automaticamente.");
    // Completamento automatico (solo client-side per ora)
    autoCompleteCarte();
  }
}, 1000);

function autoCompleteCarte() {
  const fullDeck = semi.flatMap(seme => valori.map(v => v + seme));
  while (selected.length < 8) {
    const randomCard = fullDeck[Math.floor(Math.random() * fullDeck.length)];
    if (!selected.includes(randomCard)) {
      selected.push(randomCard);
    }
  }
  updateSelectedDisplay();
  confirmBtn.disabled = false;
}

confirmBtn.addEventListener("click", () => {
  alert("Carte confermate: " + selected.join(", "));
  // Salvataggio su Firebase andrà aggiunto qui
});
