// Importa Firebase App, Auth y Analytics (compat)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  // 🔹 Constante para la URL base del API.
  // Detecta si estamos en local para usar el servidor local, de lo contrario usa Cloud Run
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocal ? 'http://localhost:8080' : 'https://booking-app-641307576548.us-central1.run.app';
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

  const showCustomMessageBox = (title, message, isError = false) => {
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
      if (!isError) closeModal();
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

      userToken = await firebaseUser.getIdToken();

      nameInput.value = firebaseUser.displayName;
      emailInput.value = firebaseUser.email;
      userPhoto.src = firebaseUser.photoURL;
      userName.textContent = firebaseUser.displayName;

      document.getElementById('google-signin-btn').style.display = 'none';
      userInfoSection.style.display = 'flex';

      showCustomMessageBox('¡Bienvenido!', `Hola, ${firebaseUser.displayName}. Ahora puedes agendar tu cita.`);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      showCustomMessageBox('Error de autenticación', 'Hubo un problema al iniciar sesión con Google.', true);
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
    e.preventDefault();
    if (!userToken) {
      showCustomMessageBox('Acceso denegado', 'Por favor, inicia sesión para agendar una cita.', true);
      return;
    }
    if (!validateStep(4)) return;

    showLoadingIndicator(true);

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

    try {
      const resp = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}` // Envía el token en el header
        },
        body: JSON.stringify(formData),
      });

      const result = await resp.json();

      if (resp.ok) {
        showCustomMessageBox('✅ Cita Agendada', 'Tu cita ha sido confirmada y se enviará una invitación a tu correo.', false);
      } else {
        const msg = result.message || 'Hubo un problema con la reserva.';
        showCustomMessageBox('❌ Error al agendar', msg, true);
      }
    } catch (error) {
      console.error('Error al enviar la reserva:', error);
      showCustomMessageBox('⚠️ Error de conexión', 'No se pudo conectar con el servidor. Inténtalo de nuevo.', true);
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
      'Paso 6 de 5: Confirma tu cita',
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
});
