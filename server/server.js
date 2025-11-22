const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');  // <- add this

const app = express();
app.use(cors());

// Serve static files from the web folder
app.use(express.static(path.join(__dirname, '../web')));

// Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/index.html'));
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Single session with password
let session = {
  password: '', // teacher sets this first
  questions: []
};

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-session', ({ name, password, role }) => {
    if (!name || !password) {
      socket.emit('join-error', 'Name and password required');
      return;
    }

    if (!session.password && role === 'teacher') {
      session.password = password;
      console.log('Teacher set session password');
    }

    if (password !== session.password) {
      socket.emit('join-error', 'Incorrect session password');
      return;
    }

    socket.join('classroom');
    socket.data = { name, role };
    socket.emit('joined', { questions: session.questions });
    console.log(`${name} joined as ${role}`);
  });

  socket.on('submit-question', ({ name, text }) => {
    const q = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      name, text,
      answered: false
    };
    session.questions.push(q);
    io.to('classroom').emit('new-question', q);
  });

  socket.on('mark-answered', ({ qid }) => {
    const q = session.questions.find(x => x.id === qid);
    if (!q) return;
    q.answered = true;
    io.to('classroom').emit('update-question', q);
  });

  socket.on('delete-question', ({ qid }) => {
    session.questions = session.questions.filter(x => x.id !== qid);
    io.to('classroom').emit('delete-question', qid);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
