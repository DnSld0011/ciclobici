// Límite aproximado del distrito de San Borja, Lima
// Fuente: trazado manual sobre OSM – margen ±30m respecto al límite oficial
export const SAN_BORJA_BOUNDARY: google.maps.LatLngLiteral[] = [
  { lat: -12.0882, lng: -77.0033 }, // NW: Javier Prado x Aviación
  { lat: -12.0882, lng: -76.9975 }, // N: Javier Prado central
  { lat: -12.0900, lng: -76.9892 }, // N: hacia Av. Canadá
  { lat: -12.0918, lng: -76.9818 }, // NE: Javier Prado x Canadá
  { lat: -12.0968, lng: -76.9762 }, // E norte: bajando Primavera
  { lat: -12.1038, lng: -76.9745 }, // E: Primavera intermedio
  { lat: -12.1118, lng: -76.9758 }, // E sur: Angamos Este
  { lat: -12.1185, lng: -76.9798 }, // SE: cruce Circunvalación
  { lat: -12.1208, lng: -76.9870 }, // S: Circunvalación este
  { lat: -12.1212, lng: -76.9968 }, // S: Circunvalación centro
  { lat: -12.1192, lng: -77.0042 }, // SW: Circunvalación x Aviación
  { lat: -12.1098, lng: -77.0055 }, // W sur: Av. Aviación
  { lat: -12.1002, lng: -77.0050 }, // W centro: Av. Aviación
  { lat: -12.0905, lng: -77.0040 }, // W norte: Av. Aviación
  { lat: -12.0882, lng: -77.0033 }, // cierre: back to NW
]
