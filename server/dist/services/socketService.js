"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
const initSocket = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*", // allow all for hackathon, lock down for prod
            methods: ["GET", "POST"]
        }
    });
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);
        socket.on('join_vault', (vaultId) => {
            socket.join(vaultId);
            console.log(`User ${socket.id} joined vault: ${vaultId}`);
        });
        socket.on('leave_vault', (vaultId) => {
            socket.leave(vaultId);
        });
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
exports.getIO = getIO;
//# sourceMappingURL=socketService.js.map