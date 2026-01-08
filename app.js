// ==========================
// MAPA BASE
// ==========================

const map = L.map('map').setView([-33.45, -70.66], 12);

// Satélite Esri
L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Esri World Imagery' }
).addTo(map);

// Capa de etiquetas, carreteras y límites (OSM)
L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '© OpenStreetMap contributors',
    opacity: 0.4
  }
).addTo(map);


// ==========================
// VARIABLES
// ==========================

let geojson = {
  type: "FeatureCollection",
  features: []
};

let marcadores = {};
let contador = 1;
let marcadorGPS = null;


// ==========================
// UTM AUTOMÁTICO WGS84
// ==========================

function obtenerUTM(lat, lon) {
  const zona = Math.floor((lon + 180) / 6) + 1;
  const hemisferioSur = lat < 0;

  const projUTM = `+proj=utm +zone=${zona} ${hemisferioSur ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;
  proj4.defs("UTM_ACTUAL", projUTM);

  const utm = proj4("EPSG:4326", "UTM_ACTUAL", [lon, lat]);

  return {
    zona,
    hemisferio: hemisferioSur ? "H" : "N",
    este: utm[0],
    norte: utm[1]
  };
}

// ==========================
// MOSTRAR COORDENADAS
// ==========================

map.on('mousemove', e => {
  const utm = obtenerUTM(e.latlng.lat, e.latlng.lng);
  document.getElementById("utm").innerHTML =
    `UTM ${utm.zona}${utm.hemisferio} | E: ${utm.este.toFixed(1)} N: ${utm.norte.toFixed(1)} (WGS84)`;
});

// ==========================
// POPUP EDITABLE
// ==========================

function popupContenido(marker, feature) {
  const lat = marker.getLatLng().lat;
  const lon = marker.getLatLng().lng;
  const utm = obtenerUTM(lat, lon);

  return `
    <b>Nombre del punto</b><br>
    <input type="text" id="nombre-${feature.id}" value="${feature.properties.name}" style="width:100%"><br><br>

    <b>Coordenadas</b><br>
    Lat: ${lat.toFixed(6)}<br>
    Lon: ${lon.toFixed(6)}<br>
    UTM ${utm.zona}${utm.hemisferio} (WGS84)<br>
    E: ${utm.este.toFixed(1)}<br>
    N: ${utm.norte.toFixed(1)}<br><br>

    <button onclick="guardarNombre(${feature.id})">Guardar nombre</button>
    <button onclick="borrarPunto(${feature.id})" style="color:red;">Borrar punto</button>
  `;
}

// ==========================
// CREAR PUNTOS
// ==========================

map.on('click', e => {
  const id = contador;
  const nombre = `Punto ${contador}`;

  const marker = L.marker(e.latlng).addTo(map);

  const feature = {
    id: id,
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [e.latlng.lng, e.latlng.lat]
    },
    properties: {
      name: nombre
    }
  };

  geojson.features.push(feature);
  marcadores[id] = marker;

  marker.bindPopup(popupContenido(marker, feature)).openPopup();

  contador++;
});

// ==========================
// GUARDAR NOMBRE
// ==========================

function guardarNombre(id) {
  const feature = geojson.features.find(f => f.id === id);
  if (!feature) return;

  const nuevoNombre = document.getElementById(`nombre-${id}`).value;
  feature.properties.name = nuevoNombre;

  marcadores[id].setPopupContent(popupContenido(marcadores[id], feature));
}

// ==========================
// BORRAR PUNTO
// ==========================

function borrarPunto(id) {
  if (!confirm("¿Eliminar este punto?")) return;

  map.removeLayer(marcadores[id]);
  geojson.features = geojson.features.filter(f => f.id !== id);
  delete marcadores[id];
}

// ==========================
// EXPORTAR KML
// ==========================

function exportarKML() {
  if (geojson.features.length === 0) {
    alert("No hay puntos para exportar");
    return;
  }

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Puntos</name>
`;

  geojson.features.forEach(f => {
    kml += `
  <Placemark>
    <name>${f.properties.name}</name>
    <Point>
      <coordinates>${f.geometry.coordinates[0]},${f.geometry.coordinates[1]},0</coordinates>
    </Point>
  </Placemark>
`;
  });

  kml += `
</Document>
</kml>`;

  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "puntos.kml";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function irAMiUbicacion() {

  if (!navigator.geolocation) {
    alert("La geolocalización no está disponible en este dispositivo");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    posicion => {

      const lat = posicion.coords.latitude;
      const lon = posicion.coords.longitude;
      const precision = posicion.coords.accuracy;

      const latlng = [lat, lon];

      // Centrar mapa
      map.setView(latlng, 17);

      // Crear o actualizar marcador GPS
      if (marcadorGPS) {
        marcadorGPS.setLatLng(latlng);
      } else {
        marcadorGPS = L.marker(latlng, {
          title: "Mi ubicación",
          icon: L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -35]
          })
        }).addTo(map);
      }

      // Popup con info
      const utm = obtenerUTM(lat, lon);

      marcadorGPS.bindPopup(`
        <b>Mi ubicación</b><br>
        Precisión: ±${precision.toFixed(1)} m<br><br>
        UTM ${utm.zona}${utm.hemisferio} (WGS84)<br>
        E: ${utm.este.toFixed(1)}<br>
        N: ${utm.norte.toFixed(1)}
      `).openPopup();

    },
    error => {
      alert("No se pudo obtener la ubicación");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}
