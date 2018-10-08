'use strict';
var messagesURL = messagesURL;
var d = new Date();

// Saves a new message on the Firebase DB.
function saveMessage(messageText) {
  // Add a new message entry to the Firebase Database.
  var ref = firebase.database().ref(messagesURL).push();
  var key = ref.key;

  ref.set({
    name: getUserName(),
    text: messageText,
    profilePicUrl: getProfilePicUrl()
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  //console.log(key);
  return ref;
}

// Saves a new message containing an image in Firebase.
// This first saves the image in Firebase storage.
function saveImageMessage(file) {
  // 1 - We add a message with a loading icon that will get updated with the shared image.
  firebase.database().ref(messagesURL).push({
    name: getUserName(),
    imageUrl: LOADING_IMAGE_URL,
    profilePicUrl: getProfilePicUrl()
  }).then(function(messageRef) {
    // 2 - Upload the image to Cloud Storage.
    var filePath = firebase.auth().currentUser.uid + '/' + messageRef.key + '/' + file.name;
    return firebase.storage().ref(filePath).put(file).then(function(fileSnapshot) {
      // 3 - Generate a public URL for the file.
      return fileSnapshot.ref.getDownloadURL().then((url) => {
        // 4 - Update the chat message placeholder with the image's URL.
        return messageRef.update({
          imageUrl: url,
          storageUri: fileSnapshot.metadata.fullPath
        });
      });
    });
  }).catch(function(error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  });
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveMessage(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Loads chat messages history and listens for upcoming ones.
function loadMessages() {
  // Loads the last 12 messages and listen for new ones.
  var callback = function(snap) {
    var data = snap.val();
    displayMessage(snap.key, data.name, data.text, data.profilePicUrl, data.imageUrl);
  };

  firebase.database().ref(messagesURL).limitToLast(10).on('child_added', callback);
  firebase.database().ref(messagesURL).limitToLast(10).on('child_changed', callback);
}


function loadConversations() {
  // Loads the last 12 messages and listen for new ones.
  var callback = function(snap) {
    var data = snap.val();
    //console.log(data);
    var curUserEmail = getUserEmail();
    var toDisplayEmail = "";
    var toDisplayName = "";

    if(data.u1 == curUserEmail) {
      toDisplayEmail = data.u2;
      toDisplayName = data.n2;
    }
    else {
      toDisplayEmail = data.u1;
      toDisplayName = data.n1;
    }

    displayChat(snap.key, toDisplayName, toDisplayEmail);
  };

  firebase.database().ref("/chats/").on('child_added', callback);
  firebase.database().ref("/chats/").on('child_changed', callback);
}

function displayChat(key, user, email) {
  if(document.getElementById(email) != null) {
    return false;
  }
  var node = document.createElement("a");

  var textnode = document.createTextNode(user+" - "+email);
  node.appendChild(textnode);

  node.setAttribute("class", "mdl-navigation__link conversation");
  node.setAttribute("href", "#");
  node.setAttribute("onclick", "chatWithUser('"+email+"')");
  node.setAttribute("id", email);
  document.getElementById("ConversationsList").appendChild(node);
}

var chatID = "";
var chatExists = false;
async function checkExistingChat(u1, u2, n1, n2) {

  let chats = await firebase.database().ref('/chats/').once('value', snapshot => {
    var chats = snapshot.val();
    //console.log('chats',chats);
    //console.log("before, chats.length: "+chats.length);

    for (var chat in chats) { 
      if (chats.hasOwnProperty(chat)) {
        //console.log(chat);
        var du1 = chats[chat].u1;
        var du2 = chats[chat].u2;

        if( (u1 == du1 || u1 == du2) && (u2 == du1 || u2 == du2) ) {
          chatID = chat;
          chatExists = true;
          
          document.getElementById("OtherPersonsName").innerHTML = u2;

          messagesURL = "/chats/"+chatID+"/messages/";
          //console.log("FOUND CHAT: "+ messagesURL);
          loadMessages();
          return true;
        }
      }
    }

    //console.log("after loop");
  });
  //console.log("after function");
  createChat(u1, u2, n1, n2);
  return false;
}


function createChat(u1, u2, n1, n2) {
  if(!chatExists) {
    var ref = firebase.database().ref('/chats/').push();
    var chatID = ref.key;

    //console.log("New Chat ID: "+chatID)
    messagesURL = "/chats/"+chatID+"/messages/";
    //console.log("U2 create chat: "+u2);
    //console.log("Create Chat n2: "+n2);

    ref.set({
      u1: u1,
      u2: u2,
      n1: n1,
      n2: n2
    }).catch(function(error) {
      console.error('Error Creating new Chat in Firebase Database', error);
    });
    //console.log(chatID);
    console.log("created new chat: "+chatID)
    document.getElementById("OtherPersonsName").innerHTML = n2;
    chatExists = true;
    loadMessages();
  }
}

var users = -1;
async function loadUser() {
  var ref = firebase.database().ref("/users/"+getUserID());
  await ref.once("value", async function(snap) {
    //console.log(snap.key);
    var data = snap.val();
    //console.log(data);
    //var u1 = snap.key;
    var u1 = data.email;
    var n1 = data.name;
    var otherUseremail = data.lastChat;

    if (otherUseremail == "" || otherUseremail == null) {
      messagesURL = "/messages/";
      document.getElementById("OtherPersonsName").innerHTML = "Everyone";
      loadMessages();
      return true;
    }

    //console.log("U1: "+u1);

    var ref2 = firebase.database().ref("/users/");
    let resp = await ref2.once("value", function(snap2) {
      
      //console.log(snap2.key);
      //console.log(snap2.val());
      var data2 = snap2.val();
      //var u2 = snap2.key;
      

      for (var user in snap2.val()) {
        if(data2[user].email == otherUseremail) {
          var u2 = data2[user].email; 
          var n2 = data2[user].name;
          //console.log("U2: "+u2);
          users = {u1: u1, u2: u2};

          var check = checkExistingChat(u1, u2, n1, n2);
          if(!check) {
            createChat(u1, u2, n1, n2);
            break;
          }
        }
        
      }
    });
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

    // We save the Firebase Messaging Device token and enable notifications.
    saveMessagingDeviceToken();

    loadUser();
  } 
  else { // User is signed out!
    window.location.href = "/";
  }
}

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

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
  '<div class="message-container messageBox">' +
    '<div class="senderRow" >'+
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="name"></div>' +
    '</div>'+
    '<div class="message"></div>' +
  '</div>';

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Displays a Message in the UI.
function displayMessage(key, name, text, picUrl, imageUrl) {
  var div = document.getElementById(key);

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

  if(name == getUserName()) {
    div.querySelector('.message').classList.add("sent");
  }
  else {
    div.querySelector('.message').classList.add("received");
  }

  var messageElement = div.querySelector('.message');
  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUrl) { // If the message is an image.
    var image = document.createElement('img');
    image.classList.add("imageMessage");
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


// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
  if (messageInputElement.value) {
    submitButtonElement.removeAttribute('disabled');
  } else {
    submitButtonElement.setAttribute('disabled', 'true');
  }
}

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
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var imageFormElement = document.getElementById('image-form');
var mediaCaptureElement = document.getElementById('mediaCapture');

// Shortcuts to DOM Elements.
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');

// Saves message on form submit.
messageFormElement.addEventListener('submit', onMessageFormSubmit);
//signOutButtonElement.addEventListener('click', signOut);
//signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload.
imageButtonElement.addEventListener('click', function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

loadConversations();