/*
  Made By:
    Steven Korevaar - s3544280
    Ryan Tran - s3201690

  References:
    1. https://codelabs.developers.google.com/codelabs/firebase-web/#0
    2. https://developers.google.com/maps/documentation/javascript/examples/marker-remove
    3. https://developers.google.com/maps/documentation/javascript/tutorial
    4. https://medium.com/@limichelle21/integrating-google-maps-api-for-multiple-locations-a4329517977a
*/

'use strict';
// Get a date object
var d = new Date();
// Create some shortcuts to commonly used elements
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');

// Saves the notification token to the datastore
function saveMessagingDeviceToken() {
  // Get the current token
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      // console.log('Got FCM device token:', currentToken);
      // Save the Token to the datastore
      firebase.database().ref('/fcmTokens').child(currentToken)
          .set(firebase.auth().currentUser.uid);
    } else {
      // If the user has not granted permission then request permissions
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
    // Notification permission granted
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

// Save the user's current location to the database once it has been loaded
var userEmail = null;
async function saveCurUserLoc(user, userLoc) {
  // Get the user's database file path
  var filepath = '/users/' + getUserID();
  //console.log("User: "+getUserID()+" @ T: "+d.getTime());

  // Get the user's email
  userEmail = getUserEmail();

  // Update the user's details
  return firebase.database().ref(filepath).update({
    name: getUserName(),
    loc: userLoc,
    time: d.getTime(),
    email: userEmail
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
}

// A function that will keep a track of whether the user is logged in or not
function authStateObserver(user) {
  // If user is not null then the user is logged in
  if (user) { 

    // Get the signed-in user's profile pic and name
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name
    userPicElement.style.backgroundImage = 'url(' + profilePicUrl + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button
    signInButtonElement.setAttribute('hidden', 'true');

    // Save the user's current location
    saveCurUserLoc(user, curUserPos);
    //console.log("USER LOGGED IN AS: "+userName);

    // Load all the other users in the Database
    loadUsers();
    showMarkers()
    // Save the user's notification token
    saveMessagingDeviceToken();
  } else {
    // If the user is not signed in
    // Hide user's profile and sign-out button
    // console.log("USER NOT LOGGED IN");
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button
    signInButtonElement.removeAttribute('hidden');
    // Clear markers
    clearMarkers();
  }
}


// Checks that Firebase has been setup correctly
checkSetup();

// Add listeners for the sign in and sign out buttons
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// initialize Firebase authorization
initFirebaseAuth();

// How long ago is the cut off for displaying "active" users?? Currently set to 
// 60 but it doesn't seem to be correllated with any actual length of time.
var timeout = 60;
// Keep a track of users which have already been drawn, otherwise, they will 
// keep being drawn over and over when they get updated.
var usersDrawn = [];

// Loads Current users history and listens for upcoming ones
function loadUsers() {
  // Only draw users if the current user is logged in
  if (!isUserSignedIn()) {
    return false;
  }
  // create a calback for when new users log in to draw their markers on the map
  var callback = function(snap) {
    // get the data of the new user
    var data = snap.val();
    // console.log("KEY:" + snap.key);
    // console.log(data);
    // console.log(locs);

    // Check whether this marker has been drawn or not
    var exists = false;
    for (var count = 0; count < usersDrawn.length; count++) {
      if(usersDrawn[count] == snap.key) {
        exists = true;
        break;
      }
    }

    // console.log("TD: "+(d.getTime() - data.time));
    // console.log("Timout: "+(timeout*60*1000));
    
    // Check whether the user's last activity was closer than the cut off time
    if( (d.getTime() - data.time) <= (timeout*60*1000) && !exists ) {
      // user has not been drawn yet
      // Place a marker on the map
      placeMarker(data, snap.key);
      // add them to the drawn list
      usersDrawn.push(snap.key)
    }
    else {
      //console.log("Not Drawn: "+snap.key+" ALREADY DRAWN? "+exists);
    }
  };

  // Set the callback to activate whenever a user or has their details change
  firebase.database().ref('/users/').on('child_added', callback);
  firebase.database().ref('/users/').on('child_changed', callback);
}

// Store the map and all the info windows 
var map, infoWindow;
var curUserPos = {
  lat: 0,
  lng: 0
};

// Initialize the map
function initMap() {
  // Create a new map at a random-ish centre and zoom level
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: -34.397, lng: 150.644},
    zoom: 14,
  });

  // create a new info window
  infoWindow = new google.maps.InfoWindow;

  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    // get the user's current location
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      // save the location in a global variable
      curUserPos = pos;
      // Set the windows position to the user's current location
      infoWindow.setPosition(pos);
      // Create a window on the users current location
      infoWindow.setContent('Location found.');
      // Open the window
      infoWindow.open(map);
      // Move the focus of the map to the user's current location
      map.setCenter(pos);

      // console.log(curUserPos.lat+", "+curUserPos.lng);
      // now that the users location has been found, display all the other 
      // users who are online
      loadUsers();

    }, function() {
      // handle an error if the location getting failed
      handleLocationError(true, infoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, infoWindow, map.getCenter());
  }
}
// A global variable to store all of the current markers on the map
var markers = [];
// Generates a new marker and places it on the map
function placeMarker(data, uID) {

  // Creates a hidden div for each user
  var contentString = "<div id='content'>"+
    "<a href=\"#\" onclick=\"chatWithUser(\'"+data.email+"\')\" class='nav-link btn btn-outline-success'>"+
    "Chat with: "+data.name+
    "</a>"+
    "</div>";
  // makes a new info window of the style made eariler.
  var infowindow = new google.maps.InfoWindow({
    content: contentString
  });

  // Creates a new marker for the user in the user's location
  var marker = new google.maps.Marker({
      position: data.loc, 
      map: map,
      title: data.name
  });

  // Adds the marker to the global list
  markers.push(marker);

  // Adds a listener to the new marker to register when it is clicked
  marker.addListener('click', function() {
    infowindow.open(map, marker);
  });
}

// Removes the markers from the map
function clearMarkers() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
}

// Removes the markers from the map
function showMarkers() {
  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(map);
  }
}

// Checks whether the browser has geolocation available
function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(browserHasGeolocation ?
        'Error: The Geolocation service failed.' :
        'Error: Your browser doesn\'t support geolocation.');
  infoWindow.open(map);
}