document.getElementById('nameInput').addEventListener('input', function () {
  const valid = this.value.trim().length >= 2;
  document.getElementById('inviteBtn').disabled = !valid;
});

document.getElementById('inviteBtn').addEventListener('click', function () {
  const playerName = document.getElementById('nameInput').value.trim();
  const gameId = Math.random().toString(36).substring(2, 10);
  const link = `${location.origin}${location.pathname}?game=${gameId}`;
  document.getElementById('gameLink').value = link;
  document.getElementById('gameLinkSection').style.display = 'block';

  // Salvataggio su Firebase (inizio partita)
  const gameRef = firebase.database().ref("games/" + gameId);
  gameRef.set({
    player1: { name: playerName, joined: true },
    createdAt: Date.now()
  });
});

function copyLink() {
  const link = document.getElementById('gameLink');
  link.select();
  document.execCommand('copy');
}
