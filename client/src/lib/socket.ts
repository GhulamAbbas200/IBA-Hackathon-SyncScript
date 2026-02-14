import { io, Socket } from 'socket.io-client';

function getSocketUrl(): string {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
    if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`;
    return 'http://localhost:4000';
}

let socket: Socket;

export const getSocket = () => {
    if (!socket) {
        socket = io(getSocketUrl(), {
            autoConnect: false,
        });
    }
    return socket;
};
