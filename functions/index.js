/*
  Made By:
    Steven Korevaar - s3544280
    Ryan Tran - s3201690

  References:
    1. https://cloud.google.com/vision/docs/face-tutorial
    2. https://codelabs.developers.google.com/codelabs/firebase-cloud-functions/#0
*/

// Import the Firebase SDK for Google Cloud Functions
const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
// Initialize the admin SDK
admin.initializeApp();

// Import the Google Cloud Vision API
const Vision = require('@google-cloud/vision');
// Create a new vision object to interact with the API
const vision = new Vision();

// Import other things we need to do this stuff
const path = require('path');
const os = require('os');
const fs = require('fs');
// Import Canvas to draw the boxes around the Faces
const Canvas = require('canvas');

// Sends a message to the chat when a new user first logs in
exports.welcomeNewUser = functions.database.ref('/users/{userID}}').onCreate( async (userSnap) => {
  console.log('A new user signed in for the first time.');
  // get user data
  const user = userSnap.val();
  // Check if the user has a name, if they don't then call them anonymous
  const fullName = user.name || 'Anonymous';

  // Send the message to the messages section of the realtime DB
  await admin.database().ref('/messages/').push({
    name: 'Firebase Bot',
    profilePicUrl: '/images/firebase-logo.png', // Firebase logo
    text: `${fullName} signed in for the first time! Welcome!`,
  });
  console.log('Welcome message written to database.');
});

// This function takes in an image and a set of faces, then draws a box around 
// each one individually
async function boundFaces(image, faces, filePath) {
  // Create a temporary image
  const Image = Canvas.Image;
  //console.log("Created Canvas");

  // Create a local file to use for editing
  const tempLocalFile = path.join(os.tmpdir(), path.basename(filePath));
  //console.log("Created Local File");

  //const messageId = filePath.split(path.sep)[1];

  // Get the Bucket where the image is stored
  const bucket = admin.storage().bucket();
  //console.log("Got the bucket");

  // Download the new temporary file from bucket
  await bucket.file(filePath).download({destination: tempLocalFile});
  //console.log('Image has been downloaded to', tempLocalFile);

  // Create a new image
  const img = new Image();

  // Paste the old image onto the new image
  img.src = tempLocalFile;
  
  // Create a new canvas with the old image onto it
  const canvas = new Canvas(img.width, img.height);
  const context = canvas.getContext('2d');
  context.drawImage(img, 0, 0, img.width, img.height);

  

  // Loop through each face in the input faces array
  faces.forEach(face => {
    // Set a default stroke style and line width as white
    context.strokeStyle = 'rgba(255,255,255,0.8)';
    context.lineWidth = '5';
    
    /*
    console.log(`    Joy: ${face.joyLikelihood}`);
    console.log(`    Anger: ${face.angerLikelihood}`);
    console.log(`    Sorrow: ${face.sorrowLikelihood}`);
    */

    // If the detected face is Happy we want to have a green square
    if(face.joyLikelihood == "LIKELY" || face.joyLikelihood == "VERY_LIKELY") {
      context.strokeStyle = 'rgba(0,255,0,0.8)';
      context.lineWidth = '5';
      console.log("JOY");
    }
    // If the detected face is Angry we want to have a red square
    else if (face.angerLikelihood == "LIKELY" || face.angerLikelihood == "VERY_LIKELY") {
      context.strokeStyle = 'rgba(255,0,0,0.8)';
      context.lineWidth = '5';
      console.log("ANGER");
    }
    // If the detected face is Sad we want to have a blue square
    else if (face.sorrowLikelihood == "LIKELY" || face.sorrowLikelihood == "VERY_LIKELY") {
      context.strokeStyle = 'rgba(0,0,255,0.8)';
      context.lineWidth = '5';
      console.log("SORROW");
    }

    // Begin a path at (0,0)
    context.beginPath();
    let origX = 0;
    let origY = 0;
    face.boundingPoly.vertices.forEach((bounds, i) => {
      // If its the first element set the path start to the starting 
      // coordinates (x, y)
      if (i === 0) {
        origX = bounds.x;
        origY = bounds.y;
      }
      // Draw a line to the next point
      context.lineTo(bounds.x, bounds.y);
    });
    // Draw a line back to the starting point of the box
    context.lineTo(origX, origY);
    context.stroke();
  });

  //console.log('Writing to file ' + tempLocalFile);

  // Create a buffer to make a new file with the drawn boxes on it
  var buf = canvas.toBuffer();
  // Write the buffer back to the local file
  fs.writeFileSync(tempLocalFile, buf);

  // Upload the file back to the Firebase database in the original image's 
  // location
  await bucket.upload(tempLocalFile, {destination: filePath});
  console.log('Faces Highlighted image has been uploaded to', filePath);

  // Delete the local file to free up space again
  fs.unlinkSync(tempLocalFile);
  console.log('Deleted local file.');
} 

// Keep a track of processed images in case the writing process retriggers the
// processing function again
var processedImages = [];
// When a new image is uploaded to the Firebase datastore then we need to run 
// the face detection algorithm on it and see if there's a face or not
exports.processImage = functions.runWith({memory: '2GB'}).storage.object().onFinalize(
  async (object) => {
    const image = {
      source: {imageUri: `gs://${object.bucket}/${object.name}`},
    };
    
    // Check if the image has been processed before, if it has then exit the 
    // function
    for (var count = 0; count < processedImages.length; count++) {
      if(processedImages[count] == object.name) {
        exists = true;
        return false;
      }
    }

    // Check the image for faces using the Cloud Vision API 
    const batchAnnotateImagesResponse = await vision.faceDetection(image);

    console.log("-------------------------------------------------");
    const faces = batchAnnotateImagesResponse[0].faceAnnotations;
    const numFaces = faces.length;
    // Check how many faces were found
    console.log('Found ' + numFaces + (numFaces === 1 ? ' face' : ' faces'));
    // Update the array to make sure we don't process the image again by 
    // accident
    processedImages.push(object.name);
    // If there is at least 1 face in the image, then we want to draw a box
    // around it, so call the boundFaces() function to do that
    if(numFaces >= 1) {
      console.log("Entering BoundFaces");
      return boundFaces(image, faces, object.name);
    }
    console.log("-------------------------------------------------");
    
  }
);

// Sends a notifications to all users when a new message is posted within the 
// Universal Chat
exports.sendNotifications = functions.database.ref('/messages/{messageId}').onCreate(
  async (snapshot) => {
    // Get the text of the message.
    const text = snapshot.val().text;
    // Set the details of the notification
    // - The title is the Person's name
    // - The Body is the first 97 characters of the message
    // - The Icon is the user's profile photo
    // - When the user clicks on the notification take them to the app
    const payload = {
      notification: {
        title: `${snapshot.val().name} posted ${text ? 'a message' : 'an image'}`,
        body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
        icon: snapshot.val().photoUrl || '/images/profile_placeholder.png',
        click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
      }
    };

    // Get the list of all tokens
    const allTokens = await admin.database().ref('fcmTokens').once('value');
    if (allTokens.exists()) {
      // Get all the token keys
      const tokens = Object.keys(allTokens.val());

      // Send notifications to all tokens
      const response = await admin.messaging().sendToDevice(tokens, payload);
      // Wait for the notifications to be sent, then clean up the tokens
      // to make sure we don't send mmultiple for the same event
      await cleanupTokens(response, tokens);
      console.log('Notifications have been sent and tokens cleaned up.');
    }
  });

// Removes all tokens that are no longer valid
function cleanupTokens(response, tokens) {
  // For each notification we check if there was an error
  const tokensToRemove = {};
  response.results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      // if there was an error print out the message and delete that token from
      // the Real time database
      console.error('Failure sending notification to', tokens[index], error);
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        tokensToRemove[`/fcmTokens/${tokens[index]}`] = null;
      }
    }
  });
  return admin.database().ref().update(tokensToRemove);
 }
