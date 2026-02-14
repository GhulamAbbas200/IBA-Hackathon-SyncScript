"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sourceController_1 = require("../controllers/sourceController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/', authMiddleware_1.authenticateToken, sourceController_1.createSource);
router.get('/', authMiddleware_1.authenticateToken, sourceController_1.getSources);
exports.default = router;
//# sourceMappingURL=sourceRoutes.js.map