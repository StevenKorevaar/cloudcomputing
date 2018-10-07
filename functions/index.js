/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Note: You will edit this file in the follow up codelab about the Cloud Functions for Firebase.

//https://codelabs.developers.google.com/codelabs/firebase-cloud-functions/#0


// Import the Firebase SDK for Google Cloud Functions.
const functions = require('firebase-functions');
// Import and initialize the Firebase Admin SDK.
const admin = require('firebase-admin');
admin.initializeApp();


const Vision = require('@google-cloud/vision');
const vision = new Vision();

const spawn = require('child-process-promise').spawn;

const path = require('path');
const os = require('os');
const fs = require('fs');


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

// Face Detection
/*
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
const fs = require('fs');
*/

function detectFaces(inputFile, callback) {
  // Make a call to the Vision API to detect the faces
  const request = {image: {source: {filename: inputFile}}};
  client
    .faceDetection(request)
    .then(results => {
      const faces = results[0].faceAnnotations;
      const numFaces = faces.length;
      console.log('Found ' + numFaces + (numFaces === 1 ? ' face' : ' faces'));
      callback(null, faces);
    })
    .catch(err => {
      console.error('ERROR:', err);
      callback(err);
    });
}

function highlightFaces(inputFile, faces, outputFile, Canvas, callback) {
  fs.readFile(inputFile, (err, image) => {
    if (err) {
      return callback(err);
    }

    const Image = Canvas.Image;
    // Open the original image into a canvas
    const img = new Image();
    img.src = image;
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

    // Write the result to a file
    console.log('Writing to file ' + outputFile);
    const writeStream = fs.createWriteStream(outputFile);
    const pngStream = canvas.pngStream();

    pngStream.on('data', chunk => {
      writeStream.write(chunk);
    });
    pngStream.on('error', console.log);
    pngStream.on('end', callback);
  });
}

async function boundFaces(image, faces, filePath) {
  console.log("INSIDE BOUND FACES");
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
  const writeStream = fs.createWriteStream(tempLocalFile);
  const pngStream = canvas.pngStream();

  await pngStream.on('data', chunk => {
    writeStream.write(chunk);
  });

  await bucket.upload(tempLocalFile, {destination: filePath});
  console.log('Faces Highlighted image has been uploaded to', filePath);
  // Deleting the local file to free up disk space.
  fs.unlinkSync(tempLocalFile);
  console.log('Deleted local file.');

} 

async function blurImage(filePath) {
  const tempLocalFile = path.join(os.tmpdir(), path.basename(filePath));
  const messageId = filePath.split(path.sep)[1];
  const bucket = admin.storage().bucket();

  // Download file from bucket.
  await bucket.file(filePath).download({destination: tempLocalFile});
  console.log('Image has been downloaded to', tempLocalFile);
  // Blur the image using ImageMagick.
  await spawn('convert', [tempLocalFile, '-channel', 'RGBA', '-blur', '0x24', tempLocalFile]);
  console.log('Image has been blurred');
  // Uploading the Blurred image back into the bucket.
  await bucket.upload(tempLocalFile, {destination: filePath});
  console.log('Blurred image has been uploaded to', filePath);
  // Deleting the local file to free up disk space.
  fs.unlinkSync(tempLocalFile);
  console.log('Deleted local file.');
  // Indicate that the message has been moderated.
  //await admin.database().ref(`/messages/${messageId}`).update({moderated: true});
  //console.log('Marked the image as moderated in the database.');
}

// Checks if uploaded images are flagged as Adult or Violence and if so blurs them.
exports.processImage = functions.runWith({memory: '2GB'}).storage.object().onFinalize(
  async (object) => {
    const image = {
      source: {imageUri: `gs://${object.bucket}/${object.name}`},
    };
    
    
    // Check the image content using the Cloud Vision API.
    const batchAnnotateImagesResponse = await vision.faceDetection(image);
    /*
    console.log("-------------------------------------------------");
    console.log("Batch Thing APPLE [0]: ");
    console.log(batchAnnotateImagesResponse[0]);
    console.log("Batch Thing APPLE [0][0]: ");
    console.log(batchAnnotateImagesResponse[0]['faceAnnotations']);
    console.log("-------------------------------------------------");
    */

   console.log("-------------------------------------------------");
    const faces = batchAnnotateImagesResponse[0].faceAnnotations;
    const numFaces = faces.length;
    console.log('Found ' + numFaces + (numFaces === 1 ? ' face' : ' faces'));

    if(numFaces >= 1) {
      console.log("Entering BoundFaces");
      return boundFaces(image, faces, object.name);
    }
    
    console.log("-------------------------------------------------");
    /*
    const safeSearchResult = batchAnnotateImagesResponse[0].safeSearchAnnotation;
    const Likelihood = Vision.types.Likelihood;
    if (Likelihood[safeSearchResult.adult] >= Likelihood.LIKELY ||
        Likelihood[safeSearchResult.violence] >= Likelihood.LIKELY) {
      console.log('The image', object.name, 'has been detected as inappropriate.');
      return blurImage(object.name);
    }
    console.log('The image', object.name, 'has been detected as OK.');
    */
  
    
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
