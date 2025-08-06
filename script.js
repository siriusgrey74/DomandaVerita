document.getElementById('emailInput').addEventListener('input', function () {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);
  document.getElementById('inviteBtn').disabled = !valid;
});

document.getElementById('inviteBtn').addEventListener('click', function () {
  const email = document.getElementById('emailInput').value;
  const gameId = Math.random().toString(36).substring(2, 10);
  const link = `${location.origin}/?game=${gameId}`;
  document.getElementById('gameLink').value = link;
  document.getElementById('gameLinkSection').style.display = 'block';
  // In una versione completa qui andrebbe registrata la partita su Firebase
});

function copyLink() {
  const link = document.getElementById('gameLink');
  link.select();
  document.execCommand('copy');
}
