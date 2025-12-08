// --- Dependencias ---
const path = require('path');
require('dotenv').config(); // Carga variables de entorno desde .env
const { google } = require('googleapis'); // SDK de Google APIs
const express = require('express'); // Framework Express para el servidor web
const cors = require('cors'); // Middleware para habilitar CORS
const admin = require('firebase-admin'); // SDK de Firebase Admin para interactuar con Firebase
const { body, validationResult } = require('express-validator'); // Para validación de datos de entrada

// --- Inicializar Firebase Admin ---
// IMPORTANTE: NO subas el archivo firebase-service-account.json a tu repositorio público.
// En un entorno de producción (como Cloud Run o Cloud Functions),
// las credenciales se deben manejar de forma segura, por ejemplo,
// a través de variables de entorno o el metadata server de GCP.
// Para desarrollo local, si usas un archivo, asegúrate de que esté ignorado por Git.
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore(); // Instancia de Firestore

// --- Configuración de Express ---
const app = express();
const PORT = process.env.PORT || 8080; // Puerto donde escuchará el servidor

// Habilita el middleware CORS para permitir solicitudes desde el frontend.
// Esto maneja correctamente las solicitudes previas (preflight requests)
// y los encabezados de autenticación.
// Configuración de CORS para permitir peticiones desde tu dominio y local
const allowedOrigins = [
  'https://salfaro.cl',
  'https://www.salfaro.cl',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:5500' // Por si usas Live Server
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como las de Postman o apps móviles)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // Si el origen no está en la lista, pero es un subdominio de firebase o cloud run, podrías permitirlo
      // Por seguridad, mejor mantenemos la lista estricta o permitimos todo si prefieres
      // Para desarrollo rápido y evitar bloqueos, permitiremos todo por ahora si falla la lista:
      return callback(null, true);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
// Middleware para parsear el cuerpo de las solicitudes como JSON.
app.use(express.json());

// 🔹 SERVIR ARCHIVOS ESTÁTICOS desde el directorio 'public'
// Esto es CRUCIAL para que el frontend (HTML, CSS, JS, imágenes) se sirva correctamente
app.use(express.static(path.join(__dirname, 'public')));

// --- Función para crear evento en Google Calendar (AHORA USANDO EL TOKEN DE ACCESO DEL USUARIO) ---
/**
 * Crea un evento en el Google Calendar principal del usuario autenticado.
 * @param {object} params
 * @param {string} params.resumen - Título del evento.
 * @param {string} params.descripcion - Descripción del evento.
 * @param {string} params.inicio - Fecha y hora de inicio en formato ISO 8601.
 * @param {string} params.fin - Fecha y hora de fin en formato ISO 8601.
 * @param {string} params.alumnoEmail - Email del usuario (puede ser usado para asistentes si se desea).
 * @param {string} params.userAccessToken - Token de acceso de OAuth 2.0 del usuario para Google Calendar.
 */
async function crearEventoCalendarUsuario({ resumen, descripcion, inicio, fin, alumnoEmail, userAccessToken }) {
  // 1. Validar que tenemos un token de acceso del usuario
  if (!userAccessToken) {
    throw new Error('No se proporcionó el token de acceso de Google Calendar del usuario.');
  }

  // 2. Usar el token de acceso del usuario para autenticar con la API de Google
  // google.auth.OAuth2 es una clase para manejar la autenticación OAuth 2.0
  const authClient = new google.auth.OAuth2();
  // Establece las credenciales usando el accessToken proporcionado por el frontend
  authClient.setCredentials({ access_token: userAccessToken });

  // Inicializa el cliente de la API de Calendar con las credenciales del usuario
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // Define la estructura del evento a crear
  const evento = {
    summary: resumen, // Título del evento
    description: descripcion, // Detalles del evento
    start: { dateTime: inicio, timeZone: 'America/Santiago' }, // Hora de inicio del evento
    end: { dateTime: fin, timeZone: 'America/Santiago' }, // Hora de fin del evento
    // Nota: 'primary' significa el calendario principal del usuario.
    // Como el evento se crea directamente en SU calendario, no es necesario
    // añadirse a sí mismo como 'attendee' a menos que quieras invitar a otros.
    // attendees: [{ email: alumnoEmail }], // Descomenta si quieres invitar explícitamente al alumno o a otros
  };

  // Inserta el evento en el calendario principal del usuario
  await calendar.events.insert({
    calendarId: 'primary', // El ID 'primary' se refiere al calendario principal del usuario autenticado
    resource: evento, // Los datos del evento
    sendUpdates: 'all' // Envía notificaciones de actualización/creación a los invitados (si los hay)
  });
}

// --- Middleware para validar el token de Firebase del usuario ---
/**
 * Middleware para verificar la autenticación del usuario mediante su token de Firebase.
 * Extrae el token de la cabecera 'Authorization', lo verifica con Firebase Admin SDK,
 * y adjunta la información del usuario decodificada a 'req.user'.
 */
async function validateFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No se proporcionó token de autenticación.' });
  }
  const idToken = authHeader.split('Bearer ')[1]; // Extrae el token
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken); // Verifica el token
    req.user = decodedToken; // Guarda la info del usuario en el objeto request
    next(); // Continúa con la siguiente función middleware o ruta
  } catch (error) {
    console.error('Error al validar token:', error);
    res.status(403).json({ message: 'Token de autenticación inválido o expirado.' });
  }
}

// --- Rutas protegidas por el middleware de autenticación ---

// Ruta para obtener los horarios ocupados (ya reservados)
app.get('/available-slots', validateFirebaseToken, async (req, res) => {
  try {
    let { fecha } = req.query;
    if (!fecha) {
      fecha = new Date().toISOString().split('T')[0]; // Usa la fecha actual si no se especifica
    }
    // Consulta Firestore para obtener reservas en la fecha dada
    const snapshot = await db.collection('reservas').where('fecha', '==', fecha).get();
    const busyTimes = snapshot.docs.map(doc => {
      const hora = doc.data().hora;
      // Calcula el inicio y fin de la cita para el formato requerido por el frontend
      const inicio = new Date(`${fecha}T${hora}:00`).toISOString();
      const fin = new Date(new Date(inicio).getTime() + 60 * 60 * 1000).toISOString(); // Asume 1 hora de duración
      return { start: inicio, end: fin };
    });
    res.json({ busyTimes });
  } catch (error) {
    console.error('Error en /available-slots:', error);
    res.status(500).json({ message: 'Error al obtener disponibilidad' });
  }
});

// Ruta para agendar una nueva reserva
app.post(
  '/book',
  validateFirebaseToken, // 🔹 Aplica el middleware de validación del token de Firebase
  [
    // Reglas de validación para los datos de entrada
    body('name').not().isEmpty().withMessage('El nombre es obligatorio'),
    body('email').isEmail().withMessage('El email no es válido'),
    body('phone').not().isEmpty().withMessage('El teléfono es obligatorio'),
    body('date').isISO8601().toDate().withMessage('La fecha no es válida'),
    body('time').not().isEmpty().withMessage('La hora es obligatoria'),
    // El 'googleCalendarAccessToken' no se valida con express-validator aquí,
    // se maneja con una verificación manual más adelante.
  ],
  async (req, res) => {
    // Verifica si hay errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Extrae los datos del cuerpo de la solicitud, incluyendo el nuevo token de Calendar
    const { phone, date, time, service, modality, address, googleCalendarAccessToken } = req.body;

    // Usa la información del token de Firebase (adjuntada por validateFirebaseToken)
    // para obtener el email y nombre del usuario autenticado, para mayor seguridad y consistencia.
    const userEmail = req.user.email;
    const userName = req.user.name;
    const userId = req.user.uid;

    // 🚨 ¡Validación específica para el token de acceso a Google Calendar!
    // Es crucial que este token esté presente para crear el evento en el calendario del usuario.
    if (!googleCalendarAccessToken) {
      return res.status(400).json({ message: 'Se requiere el token de acceso a Google Calendar.' });
    }

    try {
      // --- PASO 1: Guardar la reserva en Firestore ---
      await db.collection('reservas').add({
        userId, // ID del usuario de Firebase
        nombre: userName,
        email: userEmail,
        telefono: phone,
        fecha: date,
        hora: time,
        servicio: service || 'No especificado',
        modalidad: modality || 'No especificado',
        direccion: address || '', // Puede estar vacío si la modalidad no es presencial
        createdAt: admin.firestore.FieldValue.serverTimestamp(), // Marca de tiempo del servidor
      });

      // --- PASO 2: Crear el evento en el Google Calendar del usuario ---
      // Preparación de los datos del evento para Google Calendar
      const inicioEvento = `${date}T${time}:00`;
      // Asume una duración de 1 hora para el evento. Ajusta si tus citas tienen otra duración.
      const finEvento = new Date(new Date(inicioEvento).getTime() + 60 * 60 * 1000).toISOString();
      const descripcionEvento = `
        Servicio: ${service || 'No especificado'}
        Modalidad: ${modality || 'No especificado'}
        ${modality === 'Presencial' ? `Dirección: ${address || 'No especificada'}` : ''}
        Nombre: ${userName}
        Email: ${userEmail}
        Teléfono: ${phone}
      `;

      // 🚨 ¡LLAMADA A LA FUNCIÓN PARA CREAR EL EVENTO CON EL TOKEN DEL USUARIO! 🚨
      await crearEventoCalendarUsuario({
        resumen: service ? `${service} con ${userName}` : `Cita con ${userName}`, // Resumen del evento
        descripcion: descripcionEvento,
        inicio: inicioEvento,
        fin: finEvento,
        alumnoEmail: userEmail,
        userAccessToken: googleCalendarAccessToken // 🚨 PASAMOS EL TOKEN DE ACCESO DEL USUARIO AQUÍ
      });

      // Si todo sale bien, envía una respuesta exitosa
      res.status(200).json({ message: '¡Reserva confirmada! Evento creado en tu Google Calendar.' });
    } catch (error) {
      // Manejo de errores
      console.error('Error en /book:', error);
      // Envía un mensaje de error descriptivo al frontend
      res.status(500).json({ message: `Error backend: ${error.message}` });
    }
  }
);

// Ruta de verificación de estado
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Backend funcionando correctamente 🚀' });
});

// --- Ruta catch-all para servir el frontend ---
// Cualquier ruta GET que no coincida con las rutas de API anteriores
// servirá el archivo index.html (esto permite el routing del frontend)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Iniciar servidor ---
app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en puerto ${PORT}`);
});
