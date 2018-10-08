/*
  Made By:
    Steven Korevaar - s3544280
    Ryan Tran - s3201690

  References:
    1. https://codelabs.developers.google.com/codelabs/firebase-web/#0
*/

'use strict';
// A URL which determines where messages for this chat will be stored.
var messagesURL = messagesURL;
var d = new Date();

// Saves a new message on the Firebase DB
function saveMessage(messageText) {
  // Add a new message entry to the Firebase Database
  var ref = firebase.database().ref(messagesURL).push();
  var key = ref.key;
  //console.log(key); 
  // Push the message to the realtime database
  ref.set({
    name: getUserName(),
    text: messageText,
    profilePicUrl: getProfilePicUrl()
  }).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
  
  return ref;
}

// Saves a new message containing an image in Firebase
// This first saves the image in Firebase storage
function saveImageMessage(file) {
  // add a message with a loading icon that will get updated later with the shared image
  firebase.database().ref(messagesURL).push({
    name: getUserName(),
    imageUrl: LOADING_IMAGE_URL,
    profilePicUrl: getProfilePicUrl()
  }).then(function(messageRef) {
    // Upload the image to Cloud Storage
    var filePath = firebase.auth().currentUser.uid + '/' + messageRef.key + '/' + file.name;
    return firebase.storage().ref(filePath).put(file).then(function(fileSnapshot) {
      // Generate a public URL for the file
      return fileSnapshot.ref.getDownloadURL().then((url) => {
        // Update the chat message placeholder with the image's URL
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

// Triggered when a file is selected via the media picker
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input
  imageFormElement.reset();

  // Check if the file is an image
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

// Triggered when the send new message form is submitted
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveMessage(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button
      resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Loads chat messages history and listens for upcoming ones
function loadMessages() {
  // Loads the last 10 messages and listen for new ones
  var callback = function(snap) {
    var data = snap.val();
    displayMessage(snap.key, data.name, data.text, data.profilePicUrl, data.imageUrl);
  };

  firebase.database().ref(messagesURL).limitToLast(10).on('child_added', callback);
  firebase.database().ref(messagesURL).limitToLast(10).on('child_changed', callback);
}


// Loads all of the current users conversations into a list in the side bar
function loadConversations() {
  var callback = function(snap) {
    // get the data of this chat
    var data = snap.val();
    //console.log(data);
    var curUserEmail = getUserEmail();
    var toDisplayEmail = "";
    var toDisplayName = "";

    // check both the first and second user's email to make sure that the 
    // current user is a participant in the chat
    if(data.u1 == curUserEmail) {
      toDisplayEmail = data.u2;
      toDisplayName = data.n2;
    }
    else if (data.u2 == curUserEmail){
      toDisplayEmail = data.u1;
      toDisplayName = data.n1;
    }
    else {
      // if the user is not a participant, then don't display this chat
      return false;
    }
    // if the user was found then display the chat in the list
    displayChat(snap.key, toDisplayName, toDisplayEmail);
  };

  // Listen to added conversations incase someone new adds them
  firebase.database().ref("/chats/").on('child_added', callback);
  firebase.database().ref("/chats/").on('child_changed', callback);
}

// Display the chat in the conversations list
function displayChat(key, user, email) {
  // check if the chat has already been displayed
  if(document.getElementById(email) != null) {
    return false;
  }
  // create a new link element
  var node = document.createElement("a");

  // create a new text element with the users name and email
  var textnode = document.createTextNode(user+" - "+email);
  // append it to the link 
  node.appendChild(textnode);
  // add a few styling classes to the link
  node.setAttribute("class", "mdl-navigation__link conversation");
  // make sure it doesnt link anywhere
  node.setAttribute("href", "#");
  // when clicked the link should activate the chat with user function
  // which saves the persons email as the LastChat variable, then reloads the 
  // page, thus loading the new persons chat
  node.setAttribute("onclick", "chatWithUser('"+email+"')");
  // sets the id of the new link element to the other persons email
  node.setAttribute("id", email);
  // Append it to the conversations list
  document.getElementById("ConversationsList").appendChild(node);
}

// keep a track of the current chat ID
// and keep a track of whether we have found the right chat or not
var chatID = "";
var chatExists = false;
// This function searches through all chats to find the right one
async function checkExistingChat(u1, u2, n1, n2) {
  // Get all chats in the real time database
  let chats = await firebase.database().ref('/chats/').once('value', snapshot => {
    // get the current chats
    var chats = snapshot.val();
    //console.log('chats',chats);
    //console.log("before, chats.length: "+chats.length);

    // loop through each chat
    for (var chat in chats) { 
      // recheck that the chat is actually in the list of chats
      if (chats.hasOwnProperty(chat)) {
        //console.log(chat);
        // get the emails of both participants in the chat
        var du1 = chats[chat].u1;
        var du2 = chats[chat].u2;
        // check if the current user and the person they desired to talk to
        // are the participants in this current chat
        if( (u1 == du1 || u1 == du2) && (u2 == du1 || u2 == du2) ) {
          // if they are the participants then save the chatID
          // and remember that the chat was found
          chatID = chat;
          chatExists = true;
          // set the Chat With ... persons email to the right thing
          document.getElementById("OtherPersonsName").innerHTML = u2;
          // save the messages URL
          messagesURL = "/chats/"+chatID+"/messages/";
          //console.log("FOUND CHAT: "+ messagesURL);
          // load this chats messages with the newly found list
          loadMessages();
          // return found! yay
          return true;
        }
      }
    }
  });

  // If the chat was not found then create a new one with the desired 
  // participants
  createChat(u1, u2, n1, n2);
  return false;
}

// Creates a chat between two users
function createChat(u1, u2, n1, n2) {
  // Checks that the chat does not exist first
  if(!chatExists) {
    // Push a value to the /chats/ location and gets the ID
    var ref = firebase.database().ref('/chats/').push();
    var chatID = ref.key;
    // sets the messages URL to the newly created chat
    messagesURL = "/chats/"+chatID+"/messages/";
    // set the chats details (users and their names)
    ref.set({
      u1: u1,
      u2: u2,
      n1: n1,
      n2: n2
    }).catch(function(error) {
      console.error('Error Creating new Chat in Firebase Database', error);
    });
    // Set the displayed email to the users email
    console.log("created new chat: "+chatID)
    document.getElementById("OtherPersonsName").innerHTML = u2;
    // make sure that the chat now exists
    chatExists = true;
    // load messages, to set up message listeners
    loadMessages();
  }
}

// Global variable to keep a track of the current participants
var users = -1;
// This function will load the current users into local memory once the chat 
// has been found 
async function loadUser() {
  var ref = firebase.database().ref("/users/"+getUserID());
  // Get the data from the real time database
  await ref.once("value", async function(snap) {
    // save the data to local variables for easy access
    var data = snap.val();
    var u1 = data.email;
    var n1 = data.name;
    var otherUseremail = data.lastChat;
    // Check if the other user is not empty, if it is this means that the chat
    // should be redirected to the Universal Chat
    if (otherUseremail == "" || otherUseremail == null) {
      // set the messages URL
      messagesURL = "/messages/";
      // Show the user that they are chatting to Everyone
      document.getElementById("OtherPersonsName").innerHTML = "Everyone";
      // Load message for the universal chat
      loadMessages();
      // return true Yay!
      return true;
    }
    // if the other user is not empty then it must be another user, therefore
    // get their data
    var ref2 = firebase.database().ref("/users/");
    let resp = await ref2.once("value", function(snap2) {
      // store the data in a local variable 
      var data2 = snap2.val();
      // iterate through all users
      for (var user in snap2.val()) {
        // if the current user is the desired user to talk to 
        if(data2[user].email == otherUseremail) {
          // set their names and check if there is an existing chat
          var u2 = data2[user].email; 
          var n2 = data2[user].name;
          //console.log("U2: "+u2);
          users = {u1: u1, u2: u2};

          var check = checkExistingChat(u1, u2, n1, n2);
          if(!check) {
            // if a chat does not exist, then create one
            // this really should already have been done, but this is just 
            // making sure that it worked
            createChat(u1, u2, n1, n2);
            // once the chat is created then we don't need to go through any 
            // other users, hence return.
            return true;
          }
        }
        
      }
    });
  });
}


// A function that will keep a track of whether the user is logged in or not
function authStateObserver(user) {
  if (user) { 
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

    // We save the Firebase Messaging Device token and enable notifications
    saveMessagingDeviceToken();

    loadUser();
  } 
  else { 
    // if the user is not logged on then they shouldn't be able to see this page
    // so redirect them back to the home page
    window.location.href = "/";
  }
}

// Returns true if user is signed-in. Otherwise false and displays a message
function checkSignedInWithMessage() {
  // Return true if the user is signed in to the webpage
  if (isUserSignedIn()) {
    return true;
  }
  // if the user is not logged in then display an error message
  // this should never really occur, as the page will redirect the user if they 
  // are not logged in 
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Resets the given MaterialTextField
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages
var MESSAGE_TEMPLATE =
  '<div class="message-container messageBox">' +
    '<div class="senderRow" >'+
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="name"></div>' +
    '</div>'+
    '<div class="message"></div>' +
  '</div>';

// A loading image URL
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Appends a message to the message list
function displayMessage(key, name, text, picUrl, imageUrl) {
  // check if the message has already been displayed
  var div = document.getElementById(key);
  // If the div does not exist then create a new one and append it to the list
  if (!div) {
    // create a new div
    var container = document.createElement('div');
    // add the message template to the new div
    container.innerHTML = MESSAGE_TEMPLATE;
    // add the ID to thte message
    div = container.firstChild;
    div.setAttribute('id', key);
    // append it to the messages list
    messageListElement.appendChild(div);
  }

  // if a profile pic url exists, then add that as a background image to the
  // corressponding div
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }

  // set the senders name in the new message
  div.querySelector('.name').textContent = name;

  // if the current user sent the message then add the "sent" class to the div
  // to display as a different colour
  if(name == getUserName()) {
    div.querySelector('.message').classList.add("sent");
  }
  // otherwise add the "received" class to it
  else {
    div.querySelector('.message').classList.add("received");
  }

  var messageElement = div.querySelector('.message');
  // If the message is text
  if (text) { 
    // update the message content to the one recieved from the DB
    messageElement.textContent = text;
    // Replace all line breaks by <br>
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } 
  // If the message is an image
  else if (imageUrl) { 
    // create an image element
    var image = document.createElement('img');
    image.classList.add("imageMessage");
    // Append the date to the image source as the image name
    image.src = imageUrl + '&' + new Date().getTime();
    // Remove any inner HTML
    messageElement.innerHTML = '';
    // append the image element to the message
    messageElement.appendChild(image);
  }
  // Show the card fading-in
  setTimeout(function() {div.classList.add('visible')}, 1);

  // scroll to the top of the list
  // This currently does not work
  messageListElement.scrollTop = messageListElement.scrollHeight - 10000;
  messageInputElement.focus();

  $("#messages").animate({"scrollTop": $("#messages").position().top}, "fast");
}

// Enables or disables the submit button depending on the values of the input
// fields
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

// Checks that Firebase has been imported
checkSetup();

// Shortcuts to DOM Elements
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var imageFormElement = document.getElementById('image-form');
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');

// Saves message on form submit
messageFormElement.addEventListener('submit', onMessageFormSubmit);

// Toggle for the button
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload
imageButtonElement.addEventListener('click', function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

// Load conversations!
loadConversations();