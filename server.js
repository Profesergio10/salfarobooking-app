const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { google } = require('googleapis');
const express = require('express');

const app = express();
const port = 3000;

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly'
];

const TOKEN_PATH = path.join(process.cwd(), 'token.json');

const credentials = {
  web: {
    client_id: process.env.CLIENT_ID,
    project_id: process.env.PROJECT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: process.env.CLIENT_SECRET,
    // *** CAMBIO CLAVE PARA CLOUD RUN ***
    redirect_uris: [
      process.env.NODE_ENV === 'production' && process.env.K_SERVICE
        ? `https://${process.env.K_SERVICE}-<TU_REVISION>-uc.a.run.app/oauth2callback` // Esto necesita un ajuste manual temporal
        : 'http://localhost:3000/oauth2callback'
    ]
  }
};
// **NOTA IMPORTANTE:** La URL de Cloud Run no se puede determinar dinámicamente en tiempo de compilación.
// Para la primera implementación, tendrás que **HARDCODEARLA TEMPORALMENTE**
// o simplemente **configurar http://localhost:3000/oauth2callback y la URL final de Cloud Run
// en la consola de Google Cloud para las redirecciones autorizadas**.
// La forma más fácil para la primera implementación es mantener 'http://localhost:3000/oauth2callback' aquí
// y **añadir la URL de Cloud Run MANUAMLMENTE en la consola de Google Cloud DESPUÉS del primer despliegue**.
// Luego, si quieres, puedes volver y actualizar este array.

app.use(express.json());
app.use(express.static(__dirname));

// Cargar credenciales guardadas
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error('Error al cargar token.json:', err.message);
    return null;
  }
}

// Guardar credenciales
async function saveCredentials(client) {
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: credentials.web.client_id,
    client_secret: credentials.web.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
  console.log('Credenciales guardadas con éxito en token.json.');
}

// Obtener cliente OAuth2
async function getOAuth2Client() {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const savedCredentials = await loadSavedCredentialsIfExist();
  if (savedCredentials) {
    oAuth2Client.setCredentials(savedCredentials.credentials);
    console.log('Credenciales de Google cargadas.');
  }
  return oAuth2Client;
}

// Ruta para iniciar autenticación con Google
app.get('/auth/google', async (req, res) => {
  try {
    const oAuth2Client = await getOAuth2Client();
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error durante la autenticación:', error);
    res.status(500).json({ message: 'Hubo un error en la autenticación. Revisa la consola del servidor para más detalles.' }); // Envía JSON
  }
});

// Ruta de callback de Google
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ message: 'No se recibió el código de autorización.' }); // Envía JSON
  }

  try {
    const oAuth2Client = await getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    await saveCredentials(oAuth2Client);
    res.send('¡Autenticación exitosa! Puedes cerrar esta ventana.'); // Este .send() está bien porque es una página de respuesta del navegador
  } catch (error) {
    console.error('Error durante la autenticación:', error);
    res.status(500).json({ message: 'Hubo un error en la autenticación. Revisa la consola del servidor para más detalles.' }); // Envía JSON
  }
});

// Ruta para obtener la disponibilidad del calendario
app.get('/available-slots', async (req, res) => {
  try {
    const auth = await getOAuth2Client();
    if (!auth.credentials || !auth.credentials.refresh_token) {
      console.log('No hay credenciales. El usuario necesita autenticarse.');
      return res.json({ busyTimes: [] });
    }
    console.log('Iniciando consulta de disponibilidad del calendario...');
    const calendar = google.calendar({ version: 'v3', auth });

    const timeMin = new Date().toISOString();
    const timeMax = new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString();

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin,
        timeMax: timeMax,
        timeZone: 'America/Santiago', // Aseguramos la zona horaria
        items: [{ id: 'primary' }],
      },
    });

    const busyTimes = response.data.calendars.primary.busy;
    console.log('Consulta de disponibilidad exitosa. Horarios ocupados:', busyTimes.length);
    res.json({ busyTimes });
  } catch (error) {
    console.error('Error al obtener la disponibilidad:', error);
    res.status(500).json({ message: 'Hubo un error al obtener la disponibilidad. Revisa la consola del servidor para más detalles.' }); // Envía JSON
  }
});

// Ruta para reservar un evento
app.post('/book', async (req, res) => {
  const { name, email, phone, date, time, service, modality, address } = req.body;
  console.log('Solicitud de reserva recibida:', req.body);

  if (!name || !email || !phone || !date || !time) { // Se incluye 'phone' en la validación
    console.error('Faltan datos para la reserva.');
    // *** CAMBIADO: Envía JSON en caso de datos faltantes ***
    return res.status(400).json({ message: 'Faltan datos para la reserva.' });
  }

  const startDateTime = new Date(`${date}T${time}:00`);
  // Ajuste: Si tus citas duran un tiempo diferente a 1 hora, cambia esto.
  // Por ejemplo, para 30 minutos: `startDateTime.getTime() + 30 * 60 * 1000`
  const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); 

  try {
    const auth = await getOAuth2Client();
    if (!auth.credentials || !auth.credentials.refresh_token) {
      console.error('No hay credenciales de autenticación. Por favor, autentica la aplicación.');
      // *** CAMBIADO: Envía JSON en caso de credenciales faltantes ***
      return res.status(401).json({ message: 'No hay credenciales de autenticación. Por favor, autentica la aplicación en /auth/google' });
    }
    const calendar = google.calendar({ version: 'v3', auth });
    console.log('Credenciales de Google validadas. Intentando crear evento...');

    const eventSummary = service ? `${service} con ${name}` : `Cita con ${name}`;
    
    // --- INICIO DE LA ÚNICA MODIFICACIÓN ---
    const eventDescription = `
      **Detalles de la Cita:**
      - Servicio: ${service || 'No especificado'}
      - Modalidad: ${modality || 'No especificado'}
      ${modality === 'Presencial' ? `- Dirección: ${address || 'No especificada'}` : ''}
      
      **Datos del Cliente:**
      - Nombre: ${name || 'No especificado'}
      - Email: ${email || 'No especificado'}
      - Teléfono: ${phone || 'No especificado'}
    `.trim();
    // --- FIN DE LA ÚNICA MODIFICACIÓN ---

    const event = {
      summary: eventSummary,
      description: eventDescription,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'America/Santiago', // Aseguramos la zona horaria
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'America/Santiago', // Aseguramos la zona horaria
      },
      attendees: [
        { email: email },
        // Si quieres que te notifique a ti, puedes añadir tu propio email aquí:
        // { email: 'tu_email_aqui@gmail.com' }, 
      ],
      // Puedes añadir más opciones, por ejemplo, recordatorios
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 horas antes
          { method: 'popup', minutes: 10 },    // 10 minutos antes
        ],
      },
    };

    const calendarId = 'primary'; // Usa 'primary' para el calendario principal del usuario autenticado
    const result = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
      sendUpdates: 'all' // Envía notificaciones a los invitados (en este caso, solo el email del usuario)
    });

    console.log('Evento creado con éxito. ID:', result.data.id);
    // *** CAMBIADO: Envía respuesta JSON para que el frontend la procese correctamente ***
    res.status(200).json({ message: '¡Reserva confirmada! Se ha añadido un evento a tu calendario y se ha enviado un correo de confirmación.', eventId: result.data.id });
  } catch (error) {
    console.error('Error al crear el evento. Detalles del error:', error.message);
    if (error.response) {
      console.error('Error de respuesta de la API:', error.response.data);
    }
    // *** CAMBIADO: Envía respuesta JSON en caso de error ***
    res.status(500).json({ message: 'Hubo un error al confirmar la reserva. Revisa la consola del servidor para más detalles.', error: error.message });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});