const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.set('view engine', 'ejs');
const http = require('http').Server(app);
const io = require('socket.io')(http);
// const { PeerServer } = require('peer');
// const peerServer = PeerServer({
//   port: 3001,
// });

const nsp = io.of('/videoChat') // have a separate namespace for video chat socket

// This will be triggered when it redirects to index.html/randomUUID
app.get('/index.html', (req, res) => {
    res.render('room', { roomId: uuidv4()}) // render the 'room.ejs' and pass the page a server-side initial roomId variable that can be accessed client-side
})

// Serve static files from the 'public' directory
app.use(express.static('public')); // this must be placed after routing code


// Server-side logic to handle joining rooms and relaying offers/answers
nsp.on('connection', function(socket) {
    socket.on('join-room', (roomId, userId) => {
        socket.roomId = roomId;
        socket.userId = userId;

        socket.join(roomId)
        socket.to(roomId).emit('user-connected', userId); // broadcast to all other users in the room that the new user joined
        console.log(`User ${userId} joined room ${roomId}`)
    });

    socket.on('disconnect', () => {
        if (socket.roomId && socket.userId) {
            socket.to(socket.roomId).emit('user-disconnected', socket.userId);
            console.log(`${socket.userId} left room ${socket.roomId}`);
        }
    })

    socket.on('leave-room', (roomId, userId) => {
        socket.leave(roomId);
        //socket.to(roomId).emit('user-disconnected', userId);
        console.log(`${userId} left room ${roomId}`);
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});