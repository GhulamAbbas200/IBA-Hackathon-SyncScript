"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vaultController_1 = require("../controllers/vaultController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/', authMiddleware_1.authenticateToken, vaultController_1.createVault);
router.get('/', authMiddleware_1.authenticateToken, vaultController_1.getVaults);
exports.default = router;
//# sourceMappingURL=vaultRoutes.js.map