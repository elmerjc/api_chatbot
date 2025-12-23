const express = require("express");
const axios = require("axios");
require("dotenv").config();
const odoo = require("./odoo");

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT } = process.env;

// Ruta para verificar el webhook (GET)
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Ruta para recibir mensajes (POST)
app.post("/webhook", async (req, res) => {
    const body = req.body;

    console.log("Input:", JSON.stringify(body, null, 2));

    if (body.object) {
        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const phone_number_id =
                body.entry[0].changes[0].value.metadata.phone_number_id;
            const from = body.entry[0].changes[0].value.messages[0].from;
            const msg_body = body.entry[0].changes[0].value.messages[0].text?.body;

            if (msg_body) {
                const responseMessage = await getAutomatedResponse(msg_body, from);
                await sendMessage(phone_number_id, from, responseMessage);
            } else {
                console.log(`Message from ${from}: (Not a text message)`);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Función para determinar la respuesta automática
const getAutomatedResponse = async (text, from) => {
    const cleanText = text.toLowerCase().trim();

    if (cleanText.includes("hola") || cleanText.includes("inicio") || cleanText.includes("buenos")) {

        // Validar si el cliente existe en Odoo
        try {
            const partner = await odoo.searchPartnerByPhone(from);
            if (partner) {
                return `¡Hola ${partner.name}! 👋 Bienvenido de nuevo.\n\nVeo que eres cliente registrado. ¿En qué puedo ayudarte hoy?\n1️⃣ Estado de mis pedidos\n2️⃣ Horarios\n3️⃣ Contactar asesor`;
            }
        } catch (error) {
            console.log("Odoo check failed, falling back to default", error.message);
        }

        return "¡Hola! 👋 Bienvenido a nuestro asistente virtual.\n\nEscribe el número de la opción que deseas consultar:\n1️⃣ Información de servicios\n2️⃣ Horarios de atención\n3️⃣ Contactar a un asesor";
    }

    if (cleanText === "1" || cleanText.includes("servicios")) {
        return "🚀 Nuestros Servicios:\n- Desarrollo de Chatbots\n- Integración de APIs\n- Consultoría en Cloud\n\nEscribe 'contacto' si deseas una cotización.";
    }

    if (cleanText === "2" || cleanText.includes("horario")) {
        return "⏰ Nuestro horario de atención es:\nLunes a Viernes: 9:00 AM - 6:00 PM\nSábados: 9:00 AM - 1:00 PM";
    }

    if (cleanText === "3" || cleanText.includes("contacto") || cleanText.includes("asesor")) {
        return "📞 Puedes contactarnos directamente al +51 999 999 999 o dejarnos tu consulta aquí.";
    }

    return "🤔 No entendí tu mensaje. Por favor escribe 'Hola' para ver el menú de opciones.";
};

async function sendMessage(phone_number_id, to, text) {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${phone_number_id}/messages`,
            headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            data: {
                messaging_product: "whatsapp",
                to: to,
                text: { body: text },
            },
        });
    } catch (error) {
        console.error("Error sending message:", error?.response?.data || error);
    }
}

app.listen(PORT || 3000, () => {
    console.log(`Server is listening on port ${PORT || 3000}`);
});
