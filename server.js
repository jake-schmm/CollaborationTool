const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const http = require('http').Server(app);

// Serve static files from the 'public' directory
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const io = require('socket.io')(http);

let users = {};  // Maps UUIDs to socket IDs
const rooms = {};  // Maps room IDs to arrays of user IDs

// Server-side logic to handle joining rooms and relaying offers/answers
io.on('connection', function(socket) {

    const userId = generateUserId(); 
    users[userId] = socket.id;  // Map UUID to socket ID
    socket.userId = userId;  // Store UUID in socket session for later reference
    socket.emit('your-id', userId); // need to set up client-side code (socket.on your-id) to retrieve this value client-side

    socket.on('join-room', (roomId, userId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        // Check if the user is already in the room
        if (!rooms[roomId].includes(userId)) {
            rooms[roomId].push(userId);
            socket.join(roomId);
            socket.to(roomId).emit('user-joined', userId, socket.id);  // Notify others in the room
            console.log("User " + userId + " joined room " + roomId);
        } else {
            console.log(`User ${userId} attempted to join room ${roomId} but was already a member.`);
        }
    });

    socket.on('leave-room', (roomId, userId) => {
        // Remove user from room
        if (rooms[roomId]) {
            const index = rooms[roomId].indexOf(userId);
            if (index > -1) {
                rooms[roomId].splice(index, 1);
            }
            socket.leave(roomId);
            socket.to(roomId).emit('user-left', userId);  // Notify others in the room
        }
    });

    socket.on('send-offer', (offer, roomId, targetUserId) => {
        let targetSocketId = users[targetUserId];  // Retrieve socket ID using UUID
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive-offer', socket.userId, offer);
            console.log(`Offer sent from ${socket.userId} to ${targetUserId}`);
        } else {
            console.log(`No active socket for user ${targetUserId}`);
        }
    });

    socket.on('send-answer', (answer, roomId, targetUserId) => {
        let targetSocketId = users[targetUserId];
        if (targetSocketId) {
            console.log(`Sending answer to ${targetUserId} at socket ${targetSocketId}`);
            io.to(targetSocketId).emit('receive-answer', socket.userId, answer);
        }
    });

    socket.on('send-ice-candidate', (candidate, roomId, targetUserId) => {
        let targetSocketId = users[targetUserId];  // Retrieve socket ID using UUID
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive-ice-candidate', socket.userId, candidate);
        }
    });
        
    socket.on('pre-disconnect', () => {
        socket.disconnect(true);
    });
    
    // When disconnecting, double-check room membership
    socket.on('disconnect', () => {
        // Handle cleanup
    });

});


function generateUserId() {
    return uuidv4();
}