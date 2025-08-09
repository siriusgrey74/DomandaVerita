
// firebase-init.js - initialize RTDB (compat SDK must be loaded before)
(function(){
  if(!window.firebase){ console.error('Firebase SDK not loaded'); return; }
  if(!firebase.apps.length){ firebase.initializeApp(window.FIREBASE_CONFIG); }
  window.DB = firebase.database();
})();
