"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadController_1 = require("../controllers/uploadController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/presigned-url', authMiddleware_1.authenticateToken, uploadController_1.getUploadUrl);
exports.default = router;
//# sourceMappingURL=uploadRoutes.js.map