"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socketService_1 = require("./services/socketService");
const rateLimitMiddleware_1 = require("./middleware/rateLimitMiddleware");
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const vaultRoutes_1 = __importDefault(require("./routes/vaultRoutes"));
const sourceRoutes_1 = __importDefault(require("./routes/sourceRoutes"));
const annotationRoutes_1 = __importDefault(require("./routes/annotationRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 4000;
// Initialize Socket.io
(0, socketService_1.initSocket)(httpServer);
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Apply global rate limiter to all api routes
app.use('/api', rateLimitMiddleware_1.apiLimiter);
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
// Routes
app.use('/api/users', rateLimitMiddleware_1.authLimiter, userRoutes_1.default);
app.use('/api/vaults', vaultRoutes_1.default);
app.use('/api/sources', sourceRoutes_1.default);
app.use('/api/annotations', annotationRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.get('/', (req, res) => {
    res.send('SyncScript API is running');
});
// Start Server
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map