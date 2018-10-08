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

// Adds a message that welcomes new users into the chat.
exports.addWelcomeMessages = functions.auth.user().onCreate(async (user) => {
  console.log('A new user signed in for the first time.');
  const fullName = user.displayName || 'Anonymous';

  // Saves the new welcome message into the database
  // which then displays it in the FriendlyChat clients.
  await admin.database().ref('users').push({
    name: 'Firebase Bot',
    profilePicUrl: '/images/firebase-logo.png', // Firebase logo
    text: `${fullName} signed in for the first time! Welcome!`,
  });
  console.log('Welcome message written to database.');
});


async function boundFaces(image, faces, filePath) {
  console.log("INSIDE BOUND FACES Updated");
  const Image = Canvas.Image;
  console.log("Created Canvas");

  const tempLocalFile = path.join(os.tmpdir(), path.basename(filePath));
  console.log("Created Local File");

  const messageId = filePath.split(path.sep)[1];
  const bucket = admin.storage().bucket();
  console.log("Got the bucket");

  // Download file from bucket.
  await bucket.file(filePath).download({destination: tempLocalFile});
  console.log('Image has been downloaded to', tempLocalFile);

  // Open the original image into a canvas
  const img = new Image();

  img.src = tempLocalFile;

  const canvas = new Canvas(img.width, img.height);
  const context = canvas.getContext('2d');
  context.drawImage(img, 0, 0, img.width, img.height);

  // Now draw boxes around all the faces
  context.strokeStyle = 'rgba(0,255,0,0.8)';
  context.lineWidth = '5';

  faces.forEach(face => {
    context.beginPath();
    let origX = 0;
    let origY = 0;
    face.boundingPoly.vertices.forEach((bounds, i) => {
      if (i === 0) {
        origX = bounds.x;
        origY = bounds.y;
      }
      context.lineTo(bounds.x, bounds.y);
    });
    context.lineTo(origX, origY);
    context.stroke();
  });

  console.log('Writing to file ' + tempLocalFile);

  var buf = canvas.toBuffer();
  fs.writeFileSync(tempLocalFile, buf);

  await bucket.upload(tempLocalFile, {destination: filePath});
  console.log('Faces Highlighted image has been uploaded to', filePath);
  // Deleting the local file to free up disk space.
  fs.unlinkSync(tempLocalFile);
  console.log('Deleted local file.');

} 


var processedImages = [];
exports.processImage = functions.runWith({memory: '2GB'}).storage.object().onFinalize(
  async (object) => {
    const image = {
      source: {imageUri: `gs://${object.bucket}/${object.name}`},
    };
    
    for (var count = 0; count < processedImages.length; count++) {
      if(processedImages[count] == object.name) {
        exists = true;
        return false;
      }
    }

    // Check the image content using the Cloud Vision API.
    const batchAnnotateImagesResponse = await vision.faceDetection(image);

    console.log("-------------------------------------------------");
    const faces = batchAnnotateImagesResponse[0].faceAnnotations;
    const numFaces = faces.length;
    console.log('Found ' + numFaces + (numFaces === 1 ? ' face' : ' faces'));
    processedImages.push(object.name);
    if(numFaces >= 1) {
      console.log("Entering BoundFaces");
      return boundFaces(image, faces, object.name);
    }
    console.log("-------------------------------------------------");
    
  }
);

// Sends a notifications to all users when a new message is posted.
exports.sendNotifications = functions.database.ref('/messages/{messageId}').onCreate(
  async (snapshot) => {
    // Notification details.
    const text = snapshot.val().text;
    const payload = {
      notification: {
        title: `${snapshot.val().name} posted ${text ? 'a message' : 'an image'}`,
        body: text ? (text.length <= 100 ? text : text.substring(0, 97) + '...') : '',
        icon: snapshot.val().photoUrl || '/images/profile_placeholder.png',
        click_action: `https://${process.env.GCLOUD_PROJECT}.firebaseapp.com`,
      }
    };

    // Get the list of device tokens.
    const allTokens = await admin.database().ref('fcmTokens').once('value');
    if (allTokens.exists()) {
      // Listing all device tokens to send a notification to.
      const tokens = Object.keys(allTokens.val());

      // Send notifications to all tokens.
      const response = await admin.messaging().sendToDevice(tokens, payload);
      await cleanupTokens(response, tokens);
      console.log('Notifications have been sent and tokens cleaned up.');
    }
  });

  // Cleans up the tokens that are no longer valid.
function cleanupTokens(response, tokens) {
  // For each notification we check if there was an error.
  const tokensToRemove = {};
  response.results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      console.error('Failure sending notification to', tokens[index], error);
      // Cleanup the tokens who are not registered anymore.
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        tokensToRemove[`/fcmTokens/${tokens[index]}`] = null;
      }
    }
  });
  return admin.database().ref().update(tokensToRemove);
 }
