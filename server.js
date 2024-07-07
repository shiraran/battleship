const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('joinRoom', ({ roomId, player }) => {
    console.log(`Player ${player} joining room ${roomId}`);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { players: new Set(), ready: 0, player1Ships: null, player2Ships: null });
    }
    const room = rooms.get(roomId);
    if (room.players.size < 2) {
      room.players.add(player);
      socket.join(roomId);
      socket.emit('roomJoined', { roomId, player });
      if (room.players.size === 2) {
        io.to(roomId).emit('gameReady');
      }
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('playerReady', ({ roomId, player, ships }) => {
    console.log(`Player ${player} ready in room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) return;

    if (player === '1') {
      room.player1Ships = ships;
    } else {
      room.player2Ships = ships;
    }

    room.ready++;
    if (room.ready === 2) {
      console.log(`Game starting in room ${roomId}`);
      io.to(roomId).emit('startGame', { 
        player1Ships: room.player1Ships, 
        player2Ships: room.player2Ships 
      });
    }
  });

  socket.on('move', ({ roomId, x, y, player }) => {
    console.log(`Player ${player} made a move at (${x}, ${y}) in room ${roomId}`);
    socket.to(roomId).emit('opponentMove', { x, y, player });
  });

  socket.on('gameOver', ({ roomId, winner }) => {
    console.log(`Game over in room ${roomId}. Player ${winner} wins!`);
    io.to(roomId).emit('gameEnded', { winner });
    rooms.delete(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // You might want to handle player disconnection here
    // (e.g., notify other player, clean up room)
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));