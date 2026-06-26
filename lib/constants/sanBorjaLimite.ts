// Límite del distrito de San Borja, Lima
// Centro oficial: 12°06'26"S  76°59'56"O → (-12.1072, -76.9989)
// Área oficial: 9.96 km²
//
// Límites según fuente oficial:
//  Norte/NO  → Av. Canadá, Agustín de la Rosa Toro, calles San Miguel,
//              Mario Florián, jirones Hualgayoc y Mayor Urdanivia
//              (frontera con San Luis y La Victoria)
//  NE/Este   → Av. Javier Prado Este + Av. Circunvalación (frontera con Ate)
//  Sur/SE    → Vía de Evitamiento (Panamericana Sur) + Av. Angamos/Primavera
//              (frontera con Santiago de Surco)
//  Oeste     → Av. Guardia Civil (Del Aire) + Paseo de la República
//              (frontera con San Isidro y Surquillo)
//
// Polígono trazado en sentido horario desde esquina NW.

export const SAN_BORJA_BOUNDARY: google.maps.LatLngLiteral[] = [
  // — OESTE / NW —
  // Paseo de la República / Av. Guardia Civil (Del Aire) con frontera norte
  { lat: -12.0902, lng: -77.0098 },

  // — NORTE (irregular: múltiples calles y jirones) —
  // Tramo NO: Agustín de la Rosa Toro / conexión con San Luis
  { lat: -12.0892, lng: -77.0048 },
  { lat: -12.0880, lng: -76.9978 },  // Av. Canadá central
  // Jirón Mayor Urdanivia / Hualgayoc – quiebres irregulares
  { lat: -12.0875, lng: -76.9912 },
  { lat: -12.0868, lng: -76.9862 },
  { lat: -12.0872, lng: -76.9822 },
  // Av. Canadá tramo este / conexión con Javier Prado Este
  { lat: -12.0878, lng: -76.9785 },

  // — NORESTE: Av. Javier Prado Este x Av. Circunvalación (frontera con Ate) —
  { lat: -12.0898, lng: -76.9758 },

  // — ESTE: Av. Circunvalación bajando hacia el sur (frontera con Ate) —
  { lat: -12.0985, lng: -76.9748 },
  { lat: -12.1068, lng: -76.9748 },  // altura Jockey Plaza
  { lat: -12.1148, lng: -76.9752 },
  { lat: -12.1212, lng: -76.9762 },  // tramo Angamos Este

  // — SURESTE: Av. Circunvalación x Vía de Evitamiento —
  { lat: -12.1248, lng: -76.9782 },

  // — SUR: Vía de Evitamiento / Panamericana Sur (frontera con Santiago de Surco) —
  { lat: -12.1262, lng: -76.9878 },
  { lat: -12.1260, lng: -76.9975 },
  { lat: -12.1252, lng: -77.0068 },

  // — SUROESTE: Vía de Evitamiento x Paseo de la República / Guardia Civil —
  { lat: -12.1225, lng: -77.0148 },

  // — OESTE: Av. Guardia Civil (Del Aire) + Paseo de la República subiendo al norte —
  { lat: -12.1118, lng: -77.0168 },
  { lat: -12.1012, lng: -77.0155 },
  { lat: -12.0908, lng: -77.0118 },

  // cierre (vuelve al NW)
  { lat: -12.0902, lng: -77.0098 },
]
