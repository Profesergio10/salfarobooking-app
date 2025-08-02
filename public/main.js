// Espera a que el DOM (la estructura de la página) esté completamente cargado.
document.addEventListener('DOMContentLoaded', function() {
    // 1. Obtén el elemento del DOM donde quieres insertar el iframe.
    const formContainer = document.getElementById('form-container');

    // 2. Crea el elemento iframe.
    const iframe = document.createElement('iframe');

    // 3. Define la URL del formulario de Google con los parámetros pre-llenados.
    const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLScPLMm6y4otqm6SV4KhY71FKdbkCYXP8qViuhpjefVdJ_wyDg/viewform?usp=pp_url&entry.1615886527=Clases+de+m%C3%BAsica&entry.432257179=Sincr%C3%B3nica&entry.641434491=Antonio+Smith+2007&entry.427074158=2025-07-31&entry.1205377132=17:00&entry.1643303602=Sergio+Alfaro&entry.90527821=sf.alfaro10gmail.com";

    // 4. Establece los atributos del iframe para su correcto funcionamiento y apariencia.
    iframe.src = formUrl;
    iframe.width = "100%"; // Ocupará todo el ancho del contenedor.
    iframe.height = "800"; // Altura fija. Puedes ajustarla.
    iframe.frameBorder = "0"; // Sin borde.
    iframe.marginHeight = "0";
    iframe.marginWidth = "0";
    iframe.textContent = "Cargando…"; // Mensaje de respaldo.

    // 5. Agrega el iframe al contenedor en la página.
    formContainer.appendChild(iframe);
});