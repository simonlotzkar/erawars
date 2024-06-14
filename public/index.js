const socket = io('ws://localhost:8008');

socket.on('connect', () => {
    console.log('connected');
});