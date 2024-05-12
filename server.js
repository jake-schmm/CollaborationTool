const express = require('express');
const app = express();
const http = require('http').Server(app);

// Serve static files from the 'public' directory
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const io = require('socket.io')(http);

const roomCounts = {};
const socketRoomMap = {};  // Maps socket IDs to a list of rooms

// Server-side logic to handle joining rooms and relaying offers/answers
io.on('connection', function(socket) {

    socketRoomMap[socket.id] = [];
    
  // Join a specific room
    socket.on('join', function(roomName) {
            // Leave any previous room - necessary when switching to a new room
            Array.from(socket.rooms).forEach((room) => {
                if (room !== socket.id) { // socket.id is a default room for each socket
                    console.log("User " + socket.id + " disconnected and left room: " + room);
                    removeRoomFromMapForSocketId(socket.id, room);
                    socket.leave(room);
                    if(roomCounts[room]) {
                        roomCounts[room]--;
                        io.to(room).emit('update user count', roomCounts[room]);
                    }
                }
            });

            // Join new room
            socket.join(roomName);
            if (!socketRoomMap[socket.id].includes(roomName)) {
                socketRoomMap[socket.id].push(roomName);
            }
            roomCounts[roomName] = (roomCounts[roomName] || 0) + 1;
            io.to(roomName).emit('update user count', roomCounts[roomName]);

            console.log(`User ${socket.id} joined room ${roomName}`);
        });

    socket.on('pre-disconnect', () => {
        socket.disconnect(true);
    });
        
    // When disconnecting, double-check room membership
    socket.on('disconnect', () => {
        const rooms = socketRoomMap[socket.id];
            rooms.forEach(room => {
                roomCounts[room] = (roomCounts[room] || 1) - 1;
                io.to(room).emit('update user count', roomCounts[room]);
            });
            console.log(`User ${socket.id} disconnected and left rooms: ${rooms.join(', ')}`);
            delete socketRoomMap[socket.id];  // Clean up the map
    });

    // Relay offer to specific room
    socket.on('offer', function(offer, room) {
        socket.to(room).emit('offer', offer);
    });

    // Relay answer to specific room
    socket.on('answer', function(answer, room) {
        socket.to(room).emit('answer', answer);
    });

    // Relay ICE candidates
    socket.on('candidate', function(candidate, room) {
        socket.to(room).emit('candidate', candidate);
    });
});


function removeRoomFromMapForSocketId(socketId, roomName) {
    // Check if the socket has a list of rooms and the room exists in that list
    if (socketRoomMap[socketId] && socketRoomMap[socketId].includes(roomName)) {
        // Filter out the room from the list
        socketRoomMap[socketId] = socketRoomMap[socketId].filter(room => room !== roomName);
    }
}