document.addEventListener('DOMContentLoaded', () => {
    const bookingModal = document.getElementById('bookingModal');
    const openModalBtnHero = document.getElementById('openModalBtnHero');
    const openModalBtnNav = document.getElementById('openModalBtnNav');
    const closeModalBtn = bookingModal.querySelector('.close-btn');

    const bookingForm = document.getElementById('bookingForm');
    const steps = bookingForm.querySelectorAll('.form-step');
    const subtitle = document.getElementById('modal-subtitle');
    let currentStep = 0;

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

    // Estas referencias ya no son estrictamente necesarias a nivel global
    // ya que leeremos los valores directamente en renderSummary.
    // Pero si quieres mantenerlas para otros usos, no hay problema.
    // const nameInput = document.getElementById('name');
    // const emailInput = document.getElementById('email');
    // const phoneInput = document.getElementById('phone');


    const messageBox = document.createElement('div');
    messageBox.id = 'customMessageBox';
    const messageText = document.createElement('p');
    messageText.id = 'messageText';
    messageBox.appendChild(messageText);
    const messageButton = document.createElement('button');
    messageButton.textContent = 'OK';
    messageButton.className = 'message-button';
    
    messageButton.onclick = () => {
        messageBox.style.display = 'none';
    };
    messageBox.appendChild(messageButton);
    bookingModal.appendChild(messageBox); 

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.innerHTML = `
        <div class="spinner-container">
            <div class="spinner"></div>
            Cargando...
        </div>
    `;
    document.body.appendChild(loadingIndicator);


    let date = new Date();
    let selectedDate = null;
    let selectedModality = '';
    let busyTimes = [];

    const availableTimes = {
        1: ['17:00', '18:00'], // Lunes
        4: ['16:00', '17:00', '18:00'], // Jueves
        5: ['16:00', '17:00', '18:00'], // Viernes
    };

    const showCustomMessageBox = (title, message, shouldCloseModal = false) => {
        subtitle.textContent = title; 
        messageText.textContent = message;
        messageBox.style.display = 'block';

        messageButton.onclick = () => {
            messageBox.style.display = 'none';
            if (shouldCloseModal) {
                closeModal();
            }
        };
    };

    const showLoadingIndicator = (show) => {
        loadingIndicator.style.display = show ? 'flex' : 'none';
    };

    const fetchBusyTimes = async () => {
        console.log('Intentando obtener horarios ocupados...');
        showLoadingIndicator(true); 
        try {
            const response = await fetch('/available-slots');
            const data = await response.json();
            if (response.ok) {
                busyTimes = data.busyTimes;
                console.log('Horarios ocupados recibidos:', busyTimes);
            } else {
                showCustomMessageBox('Error al cargar horarios', data.message || response.statusText, false); 
                busyTimes = [];
                console.error('Error al cargar horarios desde el servidor:', data.message || response.statusText);
            }
        } catch (error) {
            console.error('Error fetching busy times:', error);
            showCustomMessageBox('Error de conexión', 'Error de conexión al cargar horarios.', false); 
            busyTimes = [];
        } finally {
            showLoadingIndicator(false); 
            renderCalendar();
        }
    };

    const showModal = () => {
        bookingModal.style.display = 'block';
        fetchBusyTimes();
    };

    const closeModal = () => {
        bookingModal.style.display = 'none';
        resetForm();
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            steps[currentStep].classList.remove('active');
            currentStep++;
            steps[currentStep].classList.add('active');
            updateSubtitle();
        }
    };

    const prevStep = () => {
        steps[currentStep].classList.remove('active');
        currentStep--;
        steps[currentStep].classList.add('active');
        updateSubtitle();
    };

    const updateSubtitle = () => {
        const titles = [
            'Paso 1 de 5: Elige un servicio',
            'Paso 2 de 5: Selecciona la modalidad',
            'Paso 3 de 5: Selecciona la fecha y hora',
            'Paso 4 de 5: Completa tus datos',
            'Paso 5 de 5: Confirma tu cita',
        ];
        subtitle.textContent = titles[currentStep];
    };

    const validateStep = (step) => {
        switch (step) {
            case 0: // Paso 1: Servicio
                if (selectedService.value === '') {
                    showCustomMessageBox('Error de selección', 'Por favor, selecciona un servicio.', false); 
                    return false;
                }
                return true;
            case 1: // Paso 2: Modalidad y Dirección
                if (selectedModality === '') {
                    showCustomMessageBox('Error de selección', 'Por favor, selecciona una modalidad.', false); 
                    return false;
                }
                if (selectedModality === 'Presencial' && addressInput.value.trim() === '') {
                    showCustomMessageBox('Campo requerido', 'Por favor, ingresa una dirección para la modalidad presencial.', false); 
                    return false;
                }
                return true;
            case 2: // Paso 3: Fecha y Hora
                if (selectedDate === null || selectedTimeInput.value === '') {
                    showCustomMessageBox('Error de selección', 'Por favor, selecciona una fecha y hora.', false); 
                    return false;
                }
                return true;
            case 3: // Paso 4: Datos personales (anteriormente Paso 5)
                // *** CORRECCIÓN: Obtener los valores actuales de los campos ***
                const name = document.getElementById('name').value.trim();
                const email = document.getElementById('email').value.trim();
                const phone = document.getElementById('phone').value.trim(); 

                if (name === '' || email === '') {
                    showCustomMessageBox('Campos requeridos', 'Por favor, completa tu nombre y correo electrónico.', false); 
                    return false;
                }
                if (phone === '') {
                    showCustomMessageBox('Campo requerido', 'Por favor, ingresa tu número de teléfono.', false); 
                    return false;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showCustomMessageBox('Formato inválido', 'Por favor, ingresa un correo electrónico válido.', false); 
                    return false;
                }
                return true;
            case 4: // Paso 5: Resumen final (anteriormente Paso 4, ahora el último con confirmación)
                return true;
            default:
                return false;
        }
    };

    const resetForm = () => {
        currentStep = 0;
        steps.forEach((step, index) => {
            step.classList.remove('active');
            if (index === 0) step.classList.add('active');
        });
        updateSubtitle();
        bookingForm.reset();
        selectedDate = null;
        selectedTimeInput.value = '';
        selectedModality = '';
        addressContainer.style.display = 'none';
        timeSlotsContainer.style.display = 'none';
        renderCalendar();
    };

    const renderCalendar = () => {
        const year = date.getFullYear();
        const month = date.getMonth();

        currentMonthSpan.textContent = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        calendarGrid.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        const offset = (firstDay === 0) ? 6 : firstDay - 1; 

        for (let i = 0; i < offset; i++) {
            calendarGrid.innerHTML += '<span></span>';
        }

        for (let i = 1; i <= lastDate; i++) {
            const day = new Date(year, month, i);
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            
            const dayOfWeek = (day.getDay() === 0) ? 7 : day.getDay();
            
            const hasDefinedTimes = availableTimes[dayOfWeek] && availableTimes[dayOfWeek].length > 0;
            const isInactiveDay = day < today || !hasDefinedTimes;

            const dayCell = document.createElement('div');
            dayCell.textContent = i;
            dayCell.classList.add('day-cell');
            
            if (isInactiveDay) {
                dayCell.classList.add('inactive');
            } else {
                dayCell.addEventListener('click', () => {
                    const currentSelected = calendarGrid.querySelector('.day-cell.active');
                    if (currentSelected) {
                        currentSelected.classList.remove('active');
                    }
                    dayCell.classList.add('active');
                    selectedDate = day;
                    selectedDateInput.value = day.toISOString().split('T')[0]; 
                    renderTimeSlots(dayOfWeek, day);
                });
            }
            calendarGrid.appendChild(dayCell);
        }
    };

    const renderTimeSlots = (dayOfWeek, selectedDay) => {
        timeSlots.innerHTML = '';
        selectedTimeInput.value = ''; 

        if (availableTimes[dayOfWeek]) {
            timeSlotsContainer.style.display = 'block';
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
                    slot.style.cursor = 'not-allowed';
                    slot.title = 'No disponible';
                } else {
                    slot.addEventListener('click', () => {
                        const currentSelected = timeSlots.querySelector('.time-slot.active');
                        if (currentSelected) {
                            currentSelected.classList.remove('active');
                        }
                        slot.classList.add('active');
                        selectedTimeInput.value = time; 
                    });
                }
                timeSlots.appendChild(slot);
            });
        } else {
            timeSlotsContainer.style.display = 'none';
        }
    };

    const renderSummary = () => {
        const service = selectedService.value;
        const modality = selectedModality;
        const date = selectedDate ? selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No seleccionada';
        const time = selectedTimeInput.value || 'No seleccionada';
        const address = modality === 'Presencial' ? `<li><strong>Dirección:</strong> ${addressInput.value}</li>` : '';
        
        // *** CORRECCIÓN: Obtener los valores actuales de los campos aquí ***
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();

        resumenContainer.innerHTML = `
            <ul>
                <li><strong>Servicio:</strong> ${service}</li>
                <li><strong>Modalidad:</strong> ${modality}</li>
                ${address}
                <li><strong>Fecha:</strong> ${date}</li>
                <li><strong>Hora:</strong> ${time}</li>
                <li><strong>Nombre:</strong> ${name}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Teléfono:</strong> ${phone}</li>
            </ul>
        `;
    };

    // --- Event Listeners ---
    openModalBtnHero.addEventListener('click', showModal);
    openModalBtnNav.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', closeModal);

    document.getElementById('next-1').addEventListener('click', nextStep); 
    document.getElementById('prev-2').addEventListener('click', prevStep); 
    document.getElementById('next-2').addEventListener('click', nextStep); 
    document.getElementById('prev-3').addEventListener('click', prevStep); 
    document.getElementById('next-3').addEventListener('click', () => { 
        if (validateStep(currentStep)) {
            nextStep(); // Avanza al Paso 4 (Datos personales)
        }
    });
    
    document.getElementById('prev-4').addEventListener('click', prevStep); 
    document.getElementById('next-4').addEventListener('click', () => { 
        if (validateStep(currentStep)) {
            renderSummary(); // Renderiza el resumen ANTES de pasar al Paso 5 (Confirmación)
            nextStep(); // Avanza al Paso 5 (Confirmación)
        }
    });

    document.getElementById('prev-5').addEventListener('click', prevStep); 

    document.getElementById('submitBtn').addEventListener('click', async (e) => {
        e.preventDefault(); 
        console.log('Se ha detectado el clic en el botón de Agendar Cita.');

        // Se valida el último paso (que ahora es el resumen)
        if (!validateStep(4)) { 
            console.warn('El formulario no es válido. La solicitud no se enviará.');
            return; 
        }

        console.log('Formulario válido. Preparando datos para enviar...');
        showLoadingIndicator(true); 

        const formData = {
            // *** CORRECCIÓN: Obtener los valores actuales de los campos para el envío ***
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value, 
            date: selectedDateInput.value, 
            time: selectedTimeInput.value, 
            service: selectedService.value,
            modality: selectedModality,
            address: selectedModality === 'Presencial' ? addressInput.value : ''
        };
        console.log('Datos a enviar:', formData);

        try {
            console.log('Enviando solicitud POST a /book...');
            const response = await fetch('/book', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            console.log('Respuesta del servidor recibida. Estado:', response.status);
            const result = await response.json(); 

            if (response.ok) {
                showCustomMessageBox('¡Cita agendada!', 'Tu cita ha sido confirmada y agregada a tu calendario. Revisa tu email para más detalles.', true); 
                console.log('Reserva exitosa:', result);
            } else {
                showCustomMessageBox('Error al agendar', result.message || 'Hubo un problema con la reserva. Inténtalo de nuevo.', false); 
                console.error('Error en la reserva:', result.message || result);
            }
        } catch (error) {
            console.error('Error al enviar la reserva:', error);
            showCustomMessageBox('Error de conexión', 'No se pudo conectar con el servidor. Por favor, revisa tu conexión e inténtalo de nuevo.', false); 
        } finally {
            showLoadingIndicator(false); 
        }
    });

    selectedService.addEventListener('change', () => {});
    modalityRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedModality = e.target.value;
            if (selectedModality === 'Presencial') {
                addressContainer.style.display = 'block';
            } else {
                addressContainer.style.display = 'none';
            }
        });
    });
    prevMonthBtn.addEventListener('click', () => {
        date.setMonth(date.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        date.setMonth(date.getMonth() + 1);
        renderCalendar();
    });

    fetchBusyTimes();
});