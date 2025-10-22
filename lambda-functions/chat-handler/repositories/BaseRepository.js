"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const connection_1 = require("../database/connection");
class BaseRepository {
    constructor() {
        this.db = connection_1.db;
    }
    validateMerchantId(merchantId) {
        if (!merchantId || typeof merchantId !== 'string') {
            throw new Error('Invalid merchant ID provided');
        }
    }
    validateUUID(id) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            throw new Error('Invalid UUID format');
        }
    }
}
exports.BaseRepository = BaseRepository;
