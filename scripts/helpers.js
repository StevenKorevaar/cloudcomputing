function signIn() {
  // Sign in Firebase using popup auth and Google as the identity provider.
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).then(function(user) {
    var user = firebase.auth().currentUser;
    console.log(user); // Optional
  }, function(error) {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("Error ("+errorCode+"): "+errorMessage);
  });
}

function signOut() {
  // Sign out of Firebase.
  firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
  // Listen to auth state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

function getUserEmail() {
  return firebase.auth().currentUser.email;
}

function getUserID() {
  return firebase.auth().currentUser.uid;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.database().ref('/fcmTokens').child(currentToken)
          .set(firebase.auth().currentUser.uid);
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

function openToolTip() {
  if (!isUserSignedIn()) {
    var popup = document.getElementById("mustSignInPopup");
    popup.classList.toggle("show");

    setTimeout(
      function removeToolTip(){
        var popup = document.getElementById("mustSignInPopup");
        popup.classList.remove("show");
      }
    , 4000);

    return false;
  }
}

function chatWithUser(otherUser) {
  openToolTip();
  saveChatWith(otherUser);
  window.location.href = "/chat.html";
}

function chatWithUserPosition(otherUser) {
  openToolTip();
  saveChatWith(otherUser, curUserPos);
  window.location.href = "/chat.html";
}

function saveChatWith(otherUser, pos) {
  // Add a new message entry to the Firebase Database.
  var filepath = '/users/' + getUserID();
  //console.log("OTHERUSER: "+otherUser);
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    loc: pos,
    time: d.getTime(),
    lastChat: otherUser
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}

function saveChatWith(otherUser) {
  // Add a new message entry to the Firebase Database.
  var filepath = '/users/' + getUserID();
  //console.log("OTHERUSER: "+otherUser);
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    time: d.getTime(),
    lastChat: otherUser
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}