/*
  Made By:
    Steven Korevaar - s3544280
    Ryan Tran - s3201690

  References:
    1. https://codelabs.developers.google.com/codelabs/firebase-web/#0
*/

// Handles the signing in of the user via the Google Authentication Popup Box 
function signIn() {
  // Sign into the website Google authentication
  var provider = new firebase.auth.GoogleAuthProvider();
  // Open a popup
  firebase.auth().signInWithPopup(provider).then(function(user) {
    // Get the user, if they logged in
    var user = firebase.auth().currentUser;
    console.log(user); // Optional
  }, function(error) {
    // Print out an error message if something did not work right
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("Error ("+errorCode+"): "+errorMessage);
  });
}

// Sign out of the website
function signOut() {
  firebase.auth().signOut();
}

// Add a state observer to the user's logged in state
function initFirebaseAuth() {
  // Listen to logged in state changes.
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Get the current user's profile photo or if it doesnt exist, return a 
// placeholder
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name
function getUserName() {
  return firebase.auth().currentUser.displayName;
}

// Returns the signed-in user's email
function getUserEmail() {
  return firebase.auth().currentUser.email;
}

// Returns the signed-in user's ID which is the push ID of the user's entry in 
// the real time database
function getUserID() {
  return firebase.auth().currentUser.uid;
}

// Returns true if a user is signed-in
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}

// Checks that the Firebase SDK has been correctly setup and configured
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Saves the messaging device token to the real time database
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      // console.log('Got FCM device token:', currentToken);
      // Save the Device Token to the datastore
      firebase.database().ref('/fcmTokens').child(currentToken)
          .set(firebase.auth().currentUser.uid);
    } else {
      // Request permissions to show notifications
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications
function requestNotificationsPermissions() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

// Shows a tooltip if the user tries to go to the chat page without logging in
function openToolTip() {
  // toggle the popup to be visible
  var popup = document.getElementById("mustSignInPopup");
  popup.classList.toggle("show");
  // set a timer to remove the tooltip after 4 seconds
  setTimeout(
    function removeToolTip(){
      var popup = document.getElementById("mustSignInPopup");
      popup.classList.remove("show");
    }
  , 4000);
  // end the function i guess?
  return false;
}

// Saves the chat with the user
function chatWithUser(otherUser) {
  // Check if the user is logged in
  if(isUserSignedIn()) {
    // If they are then save the chat with the inputted user
    saveChatWith(otherUser);
    // Redirect the user to the Chat page
    window.location.href = "/chat.html";
  }
  else {
    // if the user is not logged in show the tool tip telling them to log in
    openToolTip();
  }
}

var curUserPos;
// Same as above but with the current user position
function chatWithUserPosition(otherUser) {
  if(isUserSignedIn()) {
    saveChatWith(otherUser, curUserPos);
    window.location.href = "/chat.html";
  }
  else {
    openToolTip();
  }
}

// Update the current users details with their current location and the person
// that they want to chat with
function saveChatWith(otherUser, pos) {
  // Get the file path to the current user
  var filepath = '/users/' + getUserID();
  // update the current user's details 
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    loc: pos,
    time: d.getTime(),
    lastChat: otherUser
  }).catch(function(error) {
    // Catch an error if one occurs when updating the user's details
    console.error('Error writing new message to Firebase Database', error);
  });
  
}

// Same as above but without the Position
function saveChatWith(otherUser) {
  var filepath = '/users/' + getUserID();
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    time: d.getTime(),
    lastChat: otherUser
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}