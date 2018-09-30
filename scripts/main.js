'use strict';
var d = new Date();

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      // console.log('Got FCM device token:', currentToken);
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

function saveCurUserLoc(user, userLoc) {
  // Add a new message entry to the Firebase Database.
  var filepath = '/users/' + getUserID();
  //filepath = '/users/' + "steve"
  console.log("User: "+getUserID()+" @ T: "+d.getTime());
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    loc: userLoc,
    time: d.getTime()
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}

function chatWithUser(otherUser) {
  saveChatWith(otherUser);
  window.location.href = "/privateChat.html";
}

function saveChatWith(otherUser) {
  // Add a new message entry to the Firebase Database.
  var filepath = '/users/' + getUserID();
  console.log("OTHERUSER: "+otherUser);
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    loc: curUserPos,
    time: d.getTime(),
    lastChat: otherUser
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = 'url(' + profilePicUrl + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');

    saveCurUserLoc(user, curUserPos);
    console.log("USER LOGGED IN AS: "+userName);
    // We save the Firebase Messaging Device token and enable notifications.
    loadUsers();
    saveMessagingDeviceToken();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    console.log("USER NOT LOGGED IN");
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
  }
}

/*
// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Template for messages.
var MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

// Displays a Message in the UI.
function displayMessage(key, name, text, picUrl, imageUrl) {
  var div = document.getElementById(key);
  // If an element for that message does not exists yet we create it.
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    messageListElement.appendChild(div);
  }
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }
  div.querySelector('.name').textContent = name;
  var messageElement = div.querySelector('.message');
  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUrl) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    });
    image.src = imageUrl + '&' + new Date().getTime();
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  // Show the card fading-in and scroll to view the new message.
  setTimeout(function() {div.classList.add('visible')}, 1);
  messageListElement.scrollTop = messageListElement.scrollHeight;
  messageInputElement.focus();
}
*/

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');

// Saves message on form submit.
// messageFormElement.addEventListener('submit', onMessageFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// initialize Firebase
initFirebaseAuth();

var timeout = 60; // Minutes
var usersDrawn = [];

// Loads Current users history and listens for upcoming ones.
function loadUsers() {
  if (!isUserSignedIn()) {
    return false;
  }

  var callback = function(snap) {
    var data = snap.val();
    // console.log("KEY:" + snap.key);
    // console.log(data);
    // console.log(locs);

    var exists = false;

    for (var count = 0; count < usersDrawn.length; count++) {
      if(usersDrawn[count] == snap.key) {
        exists = true;
        break;
      }
    }

    // console.log("TD: "+(d.getTime() - data.time));
    // console.log("Timout: "+(timeout*60*1000));
    
    if( (d.getTime() - data.time) <= (timeout*60*1000) && !exists ) {
      usersDrawn.push(snap.key)
      placeMarker(data, snap.key);
    }
    else {
      //console.log("Not Drawn: "+snap.key+" ALREADY DRAWN? "+exists);
    }
    //displayMessage(snap.key, data.name, data.text, data.profilePicUrl, data.imageUrl);
  };

  // TODO 
  // https://firebase.google.com/docs/reference/node/firebase.database.Query
  firebase.database().ref('/users/').on('child_added', callback);
  firebase.database().ref('/users/').on('child_changed', callback);
}


// Note: This example requires that you consent to location sharing when
// prompted by your browser. If you see the error "The Geolocation service
// failed.", it means you probably did not give permission for the browser to
// locate you.
var map, infoWindow;
var curUserPos = {
  lat: 0,
  lng: 0
};

// https://medium.com/@limichelle21/integrating-google-maps-api-for-multiple-locations-a4329517977a


function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -34.397, lng: 150.644},
    zoom: 14,
  });
  infoWindow = new google.maps.InfoWindow;

  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      curUserPos = pos;

      infoWindow.setPosition(pos);
      infoWindow.setContent('Location found.');
      infoWindow.open(map);
      map.setCenter(pos);

      // console.log(curUserPos.lat+", "+curUserPos.lng);
      loadUsers();

    }, function() {
      handleLocationError(true, infoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, infoWindow, map.getCenter());
  }
}

function placeMarker(data, uID) {

  var contentString = "<div id='content'>"+
    "<a href=\"#\" onclick=\"chatWithUser(\'"+uID+"\')\" class='nav-link btn btn-outline-success'>"+
    "Chat with: "+data.name+
    "</a>"+
    "</div>";

  var infowindow = new google.maps.InfoWindow({
    content: contentString
  });

  var marker = new google.maps.Marker({
      position: data.loc, 
      map: map,
      title: data.name
  });

  marker.addListener('click', function() {
    infowindow.open(map, marker);
  });
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.');
  infoWindow.open(map);
}