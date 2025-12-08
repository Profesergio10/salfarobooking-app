// Importa Firebase App, Auth y Analytics (compat)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  // 🔹 Constante para la URL base del API.
  // Detecta si estamos en local para usar el servidor local, de lo contrario usa Cloud Run
  // 🔹 Constante para la URL base del API.
  // SE FUERZA PRODUCCIÓN para que el usuario pueda probar el backend real desde su local
  const API_BASE = 'https://booking-app-641307576548.us-central1.run.app';
  // const API_BASE = isLocal ? 'http://localhost:8080' : 'https://booking-app-641307576548.us-central1.run.app';
  console.log('Conectando a API:', API_BASE);

  // 🔹 Almacena referencias a los elementos del DOM.
  const bookingModal = document.getElementById('bookingModal');
  const bookingForm = document.getElementById('bookingForm');
  const steps = bookingForm.querySelectorAll('.form-step');
  const subtitle = document.getElementById('modal-subtitle');
  const authSection = document.getElementById('auth-section');
  const bookingSection = document.getElementById('step-1');
  const userInfoSection = document.getElementById('user-info');
  const userPhoto = document.getElementById('user-photo');
  const userName = document.getElementById('user-name');
  const startBookingBtn = document.getElementById('start-booking-btn');
  const closeBtn = document.querySelector('.close-btn');
  const loadingOverlay = document.getElementById('loading-overlay');

  // Variables para los botones que abren el modal, ahora declaradas aquí
  const openModalBtnHero = document.getElementById('openModalBtnHero');
  const openModalBtnNav = document.getElementById('openModalBtnNav');


  let currentStep = 0;
  let firebaseUser = null;
  let userToken = null;
  let googleCalendarAccessToken = null;

  const selectedService = document.getElementById('service');
  const modalityRadios = document.getElementsByName('modality');
  const addressContainer = document.getElementById('address-container');
  const addressInput = document.getElementById('address');
  const calendarGrid = document.getElementById('calendarGrid');
  const currentMonthSpan = document.getElementById('currentMonth');
  const prevMonthBtn = document.getElementById('prevMonth');
  const nextMonthBtn = document.getElementById('nextMonth');
  const timeSlotsContainer = document.getElementById('timeSlotsContainer');
  const timeSlots = document.getElementById('timeSlots');
  const selectedDateInput = document.getElementById('selectedDateInput');
  const selectedTimeInput = document.getElementById('selectedTimeInput');
  const resumenContainer = document.getElementById('resumen-container');
  const submitBtn = document.getElementById('submitBtn');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');

  // 🔹 Configuración e inicialización de Firebase
  // REMPLAZA CON TUS PROPIAS CREDENCIALES DE CLIENTE DE FIREBASE
  const firebaseConfig = {
    apiKey: "AIzaSyCKUU5hUt4mTFuPnOWNCD5GRrwHF_Fh1hE",
    authDomain: "emerald-metrics-467122-r7.firebaseapp.com",
    projectId: "emerald-metrics-467122-r7",
    storageBucket: "emerald-metrics-467122-r7.firebasestorage.app",
    messagingSenderId: "641307576548",
    appId: "1:641307576548:web:6722bcba912217dd7404f1",
  };
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  // Esta línea le dice a Google que, al iniciar sesión, tu app necesita permisos
  // para leer, crear, modificar y eliminar eventos en el calendario del usuario.

  // 🔹 Mensajería y loading refactorizados
  const messageBox = document.createElement('div');
  messageBox.id = 'customMessageBox';
  document.body.appendChild(messageBox);

  const showCustomMessageBox = (title, message, isError = false, callback = null) => {
    messageBox.innerHTML = `
      <div class="message-content ${isError ? 'error-message' : ''}">
        <h4>${title}</h4>
        <p>${message}</p>
        <button class="message-button">OK</button>
      </div>
    `;
    messageBox.style.display = 'flex';
    messageBox.querySelector('.message-button').onclick = () => {
      messageBox.style.display = 'none';
      if (callback) callback();
    };
  };

  const showLoadingIndicator = (show) => {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  };

  let date = new Date();
  let selectedDate = null;
  let selectedModality = '';
  let busyTimes = [];

  const availableTimes = {
    1: ['17:00', '18:00'],
    4: ['16:00', '17:00', '18:00'],
    5: ['16:00', '17:00', '18:00'],
  };

  // 🔹 Funciones para abrir y cerrar el modal
  const showModal = () => {
    bookingModal.style.display = 'block';
    // Restablece el formulario y el estado cada vez que se abre el modal
    resetForm();
  };

  const closeModal = () => {
    bookingModal.style.display = 'none';
  };

  // =============== AUTENTICACIÓN ===============
  const signInWithGoogle = async () => {
    try {
      showLoadingIndicator(true);
      const result = await signInWithPopup(auth, provider);
      firebaseUser = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      googleCalendarAccessToken = credential.accessToken; // ¡Guardamos el token!

      const realToken = await firebaseUser.getIdToken();

      // 🔹 VERIFICACIÓN DE CONEXIÓN AL BACKEND
      // Intentamos una llamada ligera para ver si el backend acepta el token.
      // Si falla (500, 403), lanzamos error para que caiga en el catch y active el MOCK MODE.
      try {
        const probe = await fetch(`${API_BASE}/available-slots?fecha=${new Date().toISOString().split('T')[0]}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${realToken}` }
        });
        if (!probe.ok && probe.status === 500) {
          throw new Error('Backend rechazó el token (posible error de configuración/CORS/Auth)');
        }
      } catch (e) {
        console.warn('Fallo en verificación de backend con token real:', e);
        throw e; // Esto enviará al catch principal -> Mock Mode
      }

      userToken = realToken;

      nameInput.value = firebaseUser.displayName;
      emailInput.value = firebaseUser.email;
      userPhoto.src = firebaseUser.photoURL;
      userName.textContent = firebaseUser.displayName;

      document.getElementById('google-signin-btn').style.display = 'none';
      userInfoSection.style.display = 'flex';

      showCustomMessageBox('¡Bienvenido!', `Hola, ${firebaseUser.displayName}. Ahora puedes agendar tu cita.`);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);

      // Fallback para desarrollo/local o si falla la autenticación real
      console.warn('Usando inicio de sesión simulado (Mock) por fallo en Auth.');

      firebaseUser = {
        displayName: "Usuario de Prueba",
        email: "test@ejemplo.com",
        photoURL: "https://ui-avatars.com/api/?name=Usuario+Prueba&background=random",
        getIdToken: async () => "mock-token-123"
      };

      userToken = "mock-token-123";
      googleCalendarAccessToken = "mock-access-token";

      nameInput.value = firebaseUser.displayName;
      emailInput.value = firebaseUser.email;
      userPhoto.src = firebaseUser.photoURL;
      userName.textContent = firebaseUser.displayName;

      document.getElementById('google-signin-btn').style.display = 'none';
      userInfoSection.style.display = 'flex';

      showCustomMessageBox('Modo de Prueba', 'No se pudo conectar con Google (probablemente por estar en local). Se ha iniciado una sesión de prueba para que puedas ver el resto del formulario.', false);
    } finally {
      showLoadingIndicator(false);
    }
  };

  // =============== DISPONIBILIDAD Y CALENDARIO ===============
  const fetchBusyTimes = async (fechaConsulta = null) => {
    if (!userToken) {
      showCustomMessageBox('Acceso denegado', 'Por favor, inicia sesión para agendar una cita.', true);
      return;
    }

    showLoadingIndicator(true);

    // 🔹 MOCK BYPASS: Si es usuario de prueba, no consultamos al backend real
    if (userToken === 'mock-token-123') {
      console.warn('⚠️ MOCK MODE: Usando horarios simulados.');
      busyTimes = []; // Sin horarios ocupados para prueba
      showLoadingIndicator(false);
      renderCalendar();
      if (selectedDate) {
        const dayOfWeek = (selectedDate.getDay() === 0) ? 7 : selectedDate.getDay();
        renderTimeSlots(dayOfWeek, selectedDate);
      }
      return;
    }

    fechaConsulta = fechaConsulta || new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];

    try {
      const resp = await fetch(`${API_BASE}/available-slots?fecha=${encodeURIComponent(fechaConsulta)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.message || 'No se pudieron obtener los horarios.');
      }
      const data = await resp.json();
      busyTimes = data.busyTimes || [];
    } catch (error) {
      console.error('Error fetching busy times:', error);
      showCustomMessageBox('Error de conexión', 'Error al cargar los horarios desde el servidor.', true);
      busyTimes = [];
    } finally {
      showLoadingIndicator(false);
      renderCalendar();
      if (selectedDate) {
        const dayOfWeek = (selectedDate.getDay() === 0) ? 7 : selectedDate.getDay();
        renderTimeSlots(dayOfWeek, selectedDate);
      }
    }
  };

  const renderCalendar = () => {
    // Lógica del calendario sin cambios, solo se asegura de que se actualice después de fetchBusyTimes
    const year = date.getFullYear();
    const month = date.getMonth();
    currentMonthSpan.textContent = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    calendarGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay === 0) ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) { calendarGrid.innerHTML += '<span></span>'; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= lastDate; i++) {
      const day = new Date(year, month, i);
      const dayOfWeek = (day.getDay() === 0) ? 7 : day.getDay();
      const hasDefinedTimes = !!(availableTimes[dayOfWeek] && availableTimes[dayOfWeek].length > 0);
      const isInactiveDay = day < today || !hasDefinedTimes;

      const dayCell = document.createElement('div');
      dayCell.textContent = i;
      dayCell.classList.add('day-cell');
      if (isInactiveDay) {
        dayCell.classList.add('inactive');
      } else {
        dayCell.addEventListener('click', () => {
          const currentSelected = calendarGrid.querySelector('.day-cell.active');
          if (currentSelected) currentSelected.classList.remove('active');
          dayCell.classList.add('active');
          selectedDate = day;
          selectedDateInput.value = day.toISOString().split('T')[0];
          renderTimeSlots(dayOfWeek, day);
        });
      }
      if (selectedDate && day.toDateString() === selectedDate.toDateString()) {
        dayCell.classList.add('active');
      }
      calendarGrid.appendChild(dayCell);
    }
  };

  const renderTimeSlots = (dayOfWeek, selectedDay) => {
    timeSlots.innerHTML = '';
    selectedTimeInput.value = '';

    const dayHasSlots = availableTimes[dayOfWeek];
    timeSlotsContainer.style.display = dayHasSlots ? 'block' : 'none';

    if (dayHasSlots) {
      availableTimes[dayOfWeek].forEach(time => {
        const slot = document.createElement('div');
        slot.textContent = time;
        slot.classList.add('time-slot');

        const slotDateTime = new Date(selectedDay);
        const [hours, minutes] = time.split(':').map(Number);
        slotDateTime.setHours(hours, minutes, 0, 0);

        const isBusy = busyTimes.some(busySlot => {
          const busyStart = new Date(busySlot.start);
          const busyEnd = new Date(busySlot.end);
          return (slotDateTime >= busyStart && slotDateTime < busyEnd);
        });

        if (isBusy) {
          slot.classList.add('inactive');
          slot.title = 'No disponible';
        } else {
          slot.addEventListener('click', () => {
            const currentSelected = timeSlots.querySelector('.time-slot.active');
            if (currentSelected) currentSelected.classList.remove('active');
            slot.classList.add('active');
            selectedTimeInput.value = time;
          });
        }
        if (selectedTimeInput.value === time) {
          slot.classList.add('active');
        }
        timeSlots.appendChild(slot);
      });
    }
  };

  const renderSummary = () => {
    const service = selectedService.value;
    const modality = document.querySelector('input[name="modality"]:checked')?.value || 'No seleccionada';
    const dateStr = selectedDate
      ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'No seleccionada';
    const time = selectedTimeInput.value || 'No seleccionada';
    const address = modality === 'Presencial' ? `<li><strong>Dirección:</strong> ${addressInput.value}</li>` : '';
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();

    resumenContainer.innerHTML = `
      <ul>
        <li><strong>Servicio:</strong> ${service}</li>
        <li><strong>Modalidad:</strong> ${modality}</li>
        ${address}
        <li><strong>Fecha:</strong> ${dateStr}</li>
        <li><strong>Hora:</strong> ${time}</li>
        <li><strong>Nombre:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Teléfono:</strong> ${phone}</li>
      </ul>
    `;
  };

  // =============== ENVÍO DE RESERVA ===============
  submitBtn.addEventListener('click', async (e) => {
    console.log('🏁 [DEBUG] Click en Confirmar Reserva detectado');
    e.preventDefault();

    if (!userToken) {
      console.warn('❌ [DEBUG] No hay userToken');
      showCustomMessageBox('Acceso denegado', 'Por favor, inicia sesión para agendar una cita.', true);
      return;
    }

    console.log('✅ [DEBUG] UserToken presente. Validando paso 4...');
    const isValid = validateStep(4);
    console.log('🔍 [DEBUG] validateStep(4) resultado:', isValid);

    if (!isValid) {
      console.warn('❌ [DEBUG] Validación fallida. Deteniendo envío.');
      return;
    }

    showLoadingIndicator(true);
    console.log('⏳ [DEBUG] Iniciando fetch al backend...');

    const formData = {
      name: nameInput.value,
      email: emailInput.value,
      phone: phoneInput.value,
      date: selectedDateInput.value,
      time: selectedTimeInput.value,
      service: selectedService.value,
      modality: document.querySelector('input[name="modality"]:checked')?.value || '',
      address: document.querySelector('input[name="modality"]:checked')?.value === 'Presencial' ? addressInput.value : '',
      googleCalendarAccessToken: googleCalendarAccessToken
    };

    // 🔹 MOCK SUBMISSION BYPASS (Para pruebas locales)
    if (userToken === 'mock-token-123') {
      console.warn('⚠️ MOCK MODE: Simulando envío al backend...');
      setTimeout(() => {
        showLoadingIndicator(false);
        showCustomMessageBox(
          '✅ Cita Simulada (Modo Prueba)',
          'Como estás en modo local, NO se ha enviado correo real ni agendado en calendar.\n\nEn producción (salfaro.cl), esto funcionará real.',
          false,
          closeModal
        );
      }, 1500);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}` // Envía el token en el header
        },
        body: JSON.stringify(formData),
      });

      let result;
      try {
        result = await resp.json();
      } catch (e) {
        // If response is not JSON, create a generic error message
        result = { message: 'Error desconocido del servidor (respuesta no JSON)' };
      }

      if (resp.ok) {
        showCustomMessageBox('✅ Cita Agendada', 'Tu cita ha sido confirmada y se enviará una invitación a tu correo.', false, closeModal);
      } else {
        const msg = result.message || 'Hubo un problema con la reserva.';
        showCustomMessageBox('❌ Error al agendar', `Error: ${msg}`, true);
      }
    } catch (error) {
      console.error('Error al enviar la reserva:', error);
      showCustomMessageBox('⚠️ Error de conexión', 'No se pudo conectar con el servidor. Verifica tu internet o el estado del backend.', true);
    } finally {
      showLoadingIndicator(false);
    }
  });

  // =============== STEPS Y EVENTOS UI ===============
  const nextStep = () => {
    if (validateStep(currentStep)) {
      steps[currentStep].style.display = 'none';
      currentStep++;
      steps[currentStep].style.display = 'block';
      updateSubtitle();
    }
  };

  const prevStep = () => {
    steps[currentStep].style.display = 'none';
    currentStep--;
    steps[currentStep].style.display = 'block';
    updateSubtitle();
  };

  const updateSubtitle = () => {
    const titles = [
      'Paso 1 de 5: Inicia sesión',
      'Paso 2 de 5: Elige un servicio',
      'Paso 3 de 5: Selecciona la modalidad',
      'Paso 4 de 5: Selecciona la fecha y hora',
      'Paso 5 de 5: Completa tus datos',
      'Paso 5 de 5: Confirma tu cita',
    ];
    subtitle.textContent = titles[currentStep];
  };

  const validateStep = (step) => {
    switch (step) {
      case 0: // Auth
        return userToken !== null;
      case 1: // Service
        if (selectedService.value === '') { showCustomMessageBox('Error', 'Selecciona un servicio.', true); return false; }
        return true;
      case 2: // Modality
        selectedModality = document.querySelector('input[name="modality"]:checked')?.value || '';
        if (selectedModality === '') { showCustomMessageBox('Error', 'Selecciona una modalidad.', true); return false; }
        if (selectedModality === 'Presencial' && addressInput.value.trim() === '') {
          showCustomMessageBox('Error', 'Ingresa una dirección para la modalidad presencial.', true); return false;
        }
        return true;
      case 3: // Calendar
        if (!selectedDate || !selectedTimeInput.value) { showCustomMessageBox('Error', 'Selecciona una fecha y hora.', true); return false; }
        return true;
      case 4: // User Info
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!name || !email || !phone) { showCustomMessageBox('Error', 'Completa todos los campos.', true); return false; }
        if (!emailRegex.test(email)) { showCustomMessageBox('Error', 'Ingresa un correo electrónico válido.', true); return false; }
        return true;
      case 5: // Summary
        return true;
      default:
        return false;
    }
  };

  const resetForm = () => {
    currentStep = 0;
    steps.forEach(step => step.style.display = 'none');
    authSection.style.display = 'block';
    updateSubtitle();
    bookingForm.reset();
    selectedDate = null;
    selectedDateInput.value = '';
    selectedTimeInput.value = '';
    selectedModality = '';
    addressContainer.style.display = 'none';
    timeSlotsContainer.style.display = 'none';
    renderCalendar();
    // Vuelve al estado inicial de autenticación
    document.getElementById('google-signin-btn').style.display = 'block';
    userInfoSection.style.display = 'none';
  };

  // 🔹 Event listeners para abrir y cerrar el modal y otros elementos de la UI
  openModalBtnHero.addEventListener('click', showModal);
  openModalBtnNav.addEventListener('click', showModal);
  closeBtn.addEventListener('click', closeModal);
  document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
  startBookingBtn.addEventListener('click', () => {
    console.log('🚀 BOTÓN EMPEZAR A AGENDAR CLICKEADO - VERSIÓN ACTUALIZADA');
    console.log('userToken:', userToken);
    console.log('googleCalendarAccessToken:', googleCalendarAccessToken);
    authSection.style.display = 'none';
    bookingSection.style.display = 'block';
    currentStep = 1;
    updateSubtitle();
    fetchBusyTimes();
  });

  document.getElementById('next-1').addEventListener('click', nextStep);
  document.getElementById('prev-2').addEventListener('click', prevStep);
  document.getElementById('next-2').addEventListener('click', nextStep);
  document.getElementById('prev-3').addEventListener('click', prevStep);
  document.getElementById('next-3').addEventListener('click', nextStep);
  document.getElementById('prev-4').addEventListener('click', prevStep);
  document.getElementById('next-4').addEventListener('click', () => { if (validateStep(currentStep)) { renderSummary(); nextStep(); } });
  document.getElementById('prev-5').addEventListener('click', prevStep);

  Array.from(modalityRadios).forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectedModality = e.target.value;
      addressContainer.style.display = (selectedModality === 'Presencial') ? 'block' : 'none';
    });
  });

  prevMonthBtn.addEventListener('click', () => {
    date.setMonth(date.getMonth() - 1);
    fetchBusyTimes(date.toISOString().split('T')[0]);
  });

  nextMonthBtn.addEventListener('click', () => {
    date.setMonth(date.getMonth() + 1);
    fetchBusyTimes(date.toISOString().split('T')[0]);
  });

  // Render inicial
  steps[0].style.display = 'block';
  authSection.style.display = 'block';
  updateSubtitle();

  // 🔹 Mobile Menu Logic
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      // Toggle logic using inline style or class
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '100%';
      navLinks.style.left = '0';
      navLinks.style.width = '100%';
      navLinks.style.background = 'white';
      navLinks.style.padding = '1rem';
      navLinks.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    });
  }
});
