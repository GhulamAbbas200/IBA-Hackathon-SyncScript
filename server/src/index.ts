import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initSocket } from './services/socketService';
import { apiLimiter, authLimiter } from './middleware/rateLimitMiddleware';

import userRoutes from './routes/userRoutes';
import vaultRoutes from './routes/vaultRoutes';
import sourceRoutes from './routes/sourceRoutes';
import annotationRoutes from './routes/annotationRoutes';

// Load .env from server root (reliable when running via ts-node/nodemon from any cwd)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Initialize Socket.io
initSocket(httpServer);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Apply global rate limiter to all api routes
app.use('/api', apiLimiter);

import uploadRoutes from './routes/uploadRoutes';

// Routes
app.use('/api/users', authLimiter, userRoutes);
app.use('/api/vaults', vaultRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/annotations', annotationRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => {
    res.send('SyncScript API is running');
});

// Start Server
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
