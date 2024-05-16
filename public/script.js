const socket = io('/videoChat'); // connect to socket.io server
const videoGrid = document.getElementById('videoContainer')

// Peer.js - undefined parameter means a unique id is assigned to that Peer 
// Having a unique id is important because I don't pass in host or key options
// So that means it will use Peer Cloud Service which shares ids with everyone else using Peer.js without a key or host 
const myPeer = new Peer(undefined);


// Create localVideo elements
const myVideo = document.createElement('video')
myVideo.class = 'box'
myVideo.muted = true
const myVideoBox = document.createElement('div')
myVideoBox.className = 'videoBox'

var peers = {} // Maps userIds to calls
let localStream = null; // Global scope variable to hold the media stream

// Create localVideo
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    localStream = stream
    addVideoStream(myVideo, myVideoBox, stream, null) // exclude mute button from localVideo


    // Receive calls
    myPeer.on('call', call => {
        call.answer(stream);

        if(!peers[call.peer]) { // it's important that userIds are equivalent to the id that gets generated when peer is created with undefined parameter
            connectToNewUser(call.peer, stream);
        }
    
})

    // Listen to other users connecting
    socket.off('user-connected').on('user-connected', userId => {
        if (peers[userId]) peers[userId].close(); // Close existing call if it exists
        if (!peers[userId]) {
            connectToNewUser(userId, stream) // send current video stream to newly connected user
            console.log('User connected: ' + userId)
        }
    })
})


// user-disconnected comes from other users (it's an event I created in server.js), while disconnect happens when this user disconnects
socket.on('user-disconnected', userId => {
    console.log('User ' + userId + ' diconnected');
    console.log("peers obj: " + peers[userId]);

    if(peers[userId]) {
        peers[userId].close() // close the call for the user 
        peers[userId].off('stream'); 
        delete peers[userId]; // Clean up the peer object
    }
})

socket.on('disconnect', () => {
    resetVideoGrid(); // clear video grid in case user ever reconnects
});

myPeer.on('open', userId => {
    socket.emit('join-room', ROOM_ID, userId)

    sessionStorage.setItem('myUserId', userId); // make userId available for next time you click join room
    console.log("Set userId: " + userId);
})

document.getElementById('joinRoom').addEventListener('click', function() {
    const roomId = document.getElementById('roomName').value; // Get room name from input field
    const currentSessionUserId = sessionStorage.getItem('myUserId');
    console.log("USER ID: " + currentSessionUserId);
    if (roomId) {
        // Leave the current room
        if (ROOM_ID) {
            socket.emit('leave-room', ROOM_ID, currentSessionUserId);  // Notify server of leaving the room
            disconnectOldPeers(currentSessionUserId);
        }

        // Join the new room
        ROOM_ID = roomId;
        socket.emit('join-room', ROOM_ID, currentSessionUserId);
    }
    showToastNotification("Joined " + roomId + " successfully.");
});


function disconnectOldPeers(userId) {
    Object.keys(peers).forEach(userId => {
        if (peers[userId]) {
            peers[userId].off('stream'); 
            peers[userId].close(); // Close the peer connection
        }
    });
}

// Make calls when new user connects to room
function connectToNewUser(userId, stream) {
    
    const call = myPeer.call(userId, stream);
    let isVideoAdded = false;
    console.log("Connecting to new user: " + userId);
    // Create remoteVideo
    const vidElements = createNewVideoElements();
    console.log(vidElements);
    call.on('stream', userVideoStream => {
        if(!isVideoAdded) {
            // Add remoteVideo
            addVideoStream(vidElements.video, vidElements.videoBox, userVideoStream, vidElements.muteButton) 
            isVideoAdded = true;
        }
    })

    call.on('close', () => {
        vidElements.muteButton.removeEventListener('click', handleMuteButtonClick(vidElements.muteButton, vidElements.video));
        vidElements.muteButton.remove();
        vidElements.video.remove()
        vidElements.videoBox.remove()
        isVideoAdded = false; 
        delete peers[userId];
    })

    peers[userId] = call
}

function addVideoStream(video, videoBox, stream, muteButton) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    videoBox.append(video)

    // If a muteButton was included, add it - treat the video as a remote video
    if(muteButton) {
        muteButton.addEventListener('click', () => {
            handleMuteButtonClick(muteButton, video);
        });
        videoBox.append(muteButton);
        video.style.height = myVideo.style.height;
        video.classList.add('remoteVideo');
    }

    videoGrid.append(videoBox)
}

function handleMuteButtonClick(button, video) {
    if (video.muted) {
        video.muted = false;
        button.textContent = 'Mute';
        button.classList.remove('btn-success');
        button.classList.add('btn-danger');
    } else {
        video.muted = true;
        button.textContent = 'Unmute';
        button.classList.remove('btn-danger');
        button.classList.add('btn-success')
    }
}

function createNewVideoElements() {
    const myVid = document.createElement('video')
    myVid.class = 'box'
    myVid.muted = true
    const myVidBox = document.createElement('div')
    myVidBox.className = 'videoBox'

    const muteButton = document.createElement('button');
    muteButton.classList.add('btn', 'btn-success', 'muteButton');
    muteButton.innerText = 'Unmute'

    const returnObj = {
        video: myVid,
        videoBox: myVidBox,
        muteButton: muteButton
    }

    return returnObj
}

function resetVideoGrid() {
    videoGrid.innerHTML = ''; // Clear the video grid
    addVideoStream(myVideo, myVideoBox, localStream, null); // Add the local video stream back
}

function showToastNotification(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '25%';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(0,0,0,0.7)';
    toast.style.color = 'white';
    toast.style.padding = '10px';
    toast.style.borderRadius = '5px';
    document.body.appendChild(toast);

    setTimeout(() => {
        document.body.removeChild(toast);
    }, duration);
}


