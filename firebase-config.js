
// Config Firebase (puoi sovrascriverla con la tua)
const firebaseConfig = {
  apiKey: "AIzaSyDPi2eXhnM4OJLhikPPnvrG7RWJDpk5JUs",
  authDomain: "domandaverita.firebaseapp.com",
  databaseURL: "https://domandaverita-default-rtdb.firebaseio.com",
  projectId: "domandaverita",
  storageBucket: "domandaverita.appspot.com",
  messagingSenderId: "1010215229915",
  appId: "1:1010215229915:web:960c3638629fd418beeffe"
};
try{
  if(window.firebase && !firebase.apps.length){
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase init OK (patch3)');
  }
}catch(e){
  console.log('Firebase init ERROR (patch3)', e);
}
