"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const annotationController_1 = require("../controllers/annotationController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/', authMiddleware_1.authenticateToken, annotationController_1.createAnnotation);
router.get('/', authMiddleware_1.authenticateToken, annotationController_1.getAnnotations);
exports.default = router;
//# sourceMappingURL=annotationRoutes.js.map