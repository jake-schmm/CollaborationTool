const express = require('express');
console.log("Running Node.js version:", process.version);
const { v4: uuidv4 } = require('uuid');
const app = express();
app.set('view engine', 'ejs');
const http = require('http').Server(app);
const io = require('socket.io')(http);

// Security headers
const helmet = require('helmet');
app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://res.cloudinary.com/dam11m9bq/image/upload/v1716332029/mqi1az5h_u8ulqu.png"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "https://0.peerjs.com", "wss://0.peerjs.com", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"]
    }
  }));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.xssFilter());
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

const nsp = io.of('/videoChat') // have a separate namespace for video chat socket
const roomUserCounts = {}; // Object to keep track of user counts for each room

app.get('/', (req, res) => {
    res.render('room', { roomId: uuidv4()}) // render the 'room.ejs' and pass the page a server-side initial roomId variable that can be accessed client-side
})

// Serve static files from the 'public' directory
app.use(express.static('public')); // this must be placed after routing code. Put imgs in public folder so that room.ejs can find it



// Server-side logic to handle joining rooms and relaying offers/answers
nsp.on('connection', function(socket) {
    socket.on('join-room', (roomId, userId) => {
        if(userId) { // don't count null users (i.e. if peer connection failed)
            socket.roomId = roomId;
            socket.userId = userId;
    
            if (!roomUserCounts[roomId]) {
                roomUserCounts[roomId] = 0;
            }
            roomUserCounts[roomId]++;
    
            socket.join(roomId)
            socket.emit('update-user-count', roomUserCounts[roomId]); // emit to this user that just connected (this socket)
            socket.to(roomId).emit('user-connected', userId, roomUserCounts[roomId]); // broadcast to all other users in the room that the new user joined
            console.log(`User ${userId} joined room ${roomId}, userCount: ${roomUserCounts[roomId]}`)
        }
    });

    socket.on('disconnect', () => {
        if (socket.roomId && socket.userId) {
            roomUserCounts[socket.roomId]--;
            socket.to(socket.roomId).emit('user-disconnected', socket.userId, roomUserCounts[socket.roomId]);
            socket.to(socket.roomId).emit('update-user-count', roomUserCounts[socket.roomId]);
            console.log(`${socket.userId} left room ${socket.roomId}, userCount: ${roomUserCounts[socket.roomId]}`);
        }
    })

    socket.on('leave-room', (roomId, userId) => {
        socket.leave(roomId);
        if (roomUserCounts[roomId]) {
            roomUserCounts[roomId]--;
            socket.to(roomId).emit('update-user-count', roomUserCounts[roomId]);
            socket.to(roomId).emit('user-disconnected', userId, roomUserCounts[roomId]);
            console.log(`${userId} left room ${roomId}, userCount: ${roomUserCounts[roomId]}`);
        }
        //socket.to(roomId).emit('user-disconnected', userId);
        
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});