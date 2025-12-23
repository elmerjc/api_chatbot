const axios = require("axios");

class OdooClient {
    constructor() {
        this.url = process.env.ODOO_URL;
        this.db = process.env.ODOO_DB;
        this.username = process.env.ODOO_USERNAME;
        this.password = process.env.ODOO_PASSWORD;
        this.uid = null;
    }

    async connect() {
        if (this.uid) return this.uid;

        try {
            const response = await axios.post(`${this.url}/jsonrpc`, {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "common",
                    method: "login",
                    args: [this.db, this.username, this.password],
                },
                id: Math.floor(Math.random() * 1000000),
            });

            if (response.data.result) {
                this.uid = response.data.result;
                console.log("Conectado a Odoo correctamente. UID:", this.uid);
                return this.uid;
            } else {
                console.error("Error de autenticación Odoo:", response.data);
                return null;
            }
        } catch (error) {
            console.error("Error conectando a Odoo:", error.message);
            return null;
        }
    }

    async executeKw(model, method, args = [], kwargs = {}) {
        const uid = await this.connect();
        if (!uid) throw new Error("No se pudo autenticar con Odoo");

        try {
            const response = await axios.post(`${this.url}/jsonrpc`, {
                jsonrpc: "2.0",
                method: "call",
                params: {
                    service: "object",
                    method: "execute_kw",
                    args: [this.db, uid, this.password, model, method, args, kwargs],
                },
                id: Math.floor(Math.random() * 1000000),
            });

            if (response.data.error) {
                throw new Error(response.data.error.data.message);
            }

            return response.data.result;
        } catch (error) {
            console.error(`Error ejecutando ${model}.${method}:`, error.message);
            throw error;
        }
    }

    // Helper específico para buscar contacto por teléfono
    async searchPartnerByPhone(phone) {
        // Normalizar teléfono (ejemplo simple, quitar +)
        const normalizedPhone = phone.replace('+', '');
        // Buscar en mobile o phone
        // Nota: Odoo a veces guarda con espacios, idealmente limpieza más profunda
        const domain = ['|', ['phone', 'ilike', normalizedPhone], ['mobile', 'ilike', normalizedPhone]];

        const fields = ['name', 'email', 'phone'];
        const partners = await this.executeKw('res.partner', 'search_read', [domain], { fields: fields, limit: 1 });

        return partners.length > 0 ? partners[0] : null;
    }
}

module.exports = new OdooClient();
