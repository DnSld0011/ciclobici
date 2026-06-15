-- ============================================================
-- CicloBici — Migración 002
-- Parche trigger fn_finalizar_viaje:
-- Si el cliente envía distancia_km real (GPS), no sobreescribir.
-- Solo estimar con velocidad promedio si distancia_km es NULL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_finalizar_viaje()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fin_at IS NOT NULL AND OLD.fin_at IS NULL THEN
    -- Siempre calcular duración exacta desde timestamps
    NEW.duracion_min := ROUND(EXTRACT(EPOCH FROM (NEW.fin_at - NEW.inicio_at)) / 60)::INTEGER;

    -- Solo estimar distancia si el cliente NO envió datos GPS
    IF NEW.distancia_km IS NULL THEN
      -- Estimación conservadora: 10 km/h promedio en ciudad
      NEW.distancia_km := ROUND((NEW.duracion_min::NUMERIC / 60.0) * 10.0, 2);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-crear el trigger (la función ya fue reemplazada, el trigger no cambia)
DROP TRIGGER IF EXISTS trg_finalizar_viaje ON public.viajes;
CREATE TRIGGER trg_finalizar_viaje
  BEFORE UPDATE OF fin_at ON public.viajes
  FOR EACH ROW EXECUTE FUNCTION public.fn_finalizar_viaje();
