
function getGameIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("game");
}

const gameId = getGameIdFromUrl();

if (gameId) {
  document.getElementById("creatorSection").style.display = "none";
  document.getElementById("inviteeSection").style.display = "block";

  const gameRef = firebase.database().ref("games/" + gameId);
  gameRef.once("value").then(snapshot => {
    const gameData = snapshot.val();
    if (!gameData) {
      document.getElementById("status").innerText = "Invito non valido.";
      return;
    }
    document.getElementById("player1Info").innerText =
      "Sei stato invitato da: " + gameData.player1.name;
  });

  document.getElementById("nameInput2").addEventListener("input", function () {
    document.getElementById("acceptBtn").disabled = this.value.trim().length < 2;
  });

  document.getElementById("acceptBtn").addEventListener("click", function () {
    const name = document.getElementById("nameInput2").value.trim();
    firebase.database().ref("games/" + gameId + "/player2").set({
      name: name,
      joined: true
    });
    document.getElementById("status").innerText = "Hai accettato l'invito.";
  });

  document.getElementById("rejectBtn").addEventListener("click", function () {
    firebase.database().ref("games/" + gameId + "/refused").set(true);
    document.getElementById("status").innerText = "Hai rifiutato l'invito.";
  });

} else {
  document.getElementById("nameInput").addEventListener("input", function () {
    const valid = this.value.trim().length >= 2;
    document.getElementById("inviteBtn").disabled = !valid;
  });

  document.getElementById("inviteBtn").addEventListener("click", function () {
    const playerName = document.getElementById("nameInput").value.trim();
    const newGameId = Math.random().toString(36).substring(2, 10);
    const link = `${location.origin}${location.pathname}?game=${newGameId}`;
    document.getElementById("gameLink").value = link;
    document.getElementById("gameLinkSection").style.display = "block";
    firebase.database().ref("games/" + newGameId).set({
      player1: { name: playerName, joined: true },
      createdAt: Date.now()
    });
  });
}

function copyLink() {
  const link = document.getElementById('gameLink');
  link.select();
  document.execCommand('copy');
}
