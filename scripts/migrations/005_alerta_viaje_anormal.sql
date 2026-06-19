-- ============================================================
-- CicloBici — Migración 005
-- Alerta automática: viaje activo > 120 minutos (bici sin retornar)
-- ============================================================

-- Función: al actualizar updated_at de un viaje o al insertar
-- Si el viaje lleva más de 120 min activo → alerta bici_sin_retornar
CREATE OR REPLACE FUNCTION public.fn_alerta_viaje_anormal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_minutos  NUMERIC;
  v_bici_cod TEXT;
BEGIN
  -- Solo aplica a viajes activos con inicio_at definido
  IF NEW.estado != 'activo' OR NEW.inicio_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_minutos := EXTRACT(EPOCH FROM (now() - NEW.inicio_at)) / 60;

  IF v_minutos > 120 THEN
    SELECT codigo INTO v_bici_cod FROM public.bicicletas WHERE id = NEW.bicicleta_id;

    INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, bicicleta_id)
    VALUES (
      'bici_sin_retornar',
      'critica',
      'Viaje anormal: ' || COALESCE(v_bici_cod, 'bici desconocida'),
      'Lleva ' || ROUND(v_minutos) || ' minutos activo sin finalizar. Posible incidencia o extravío.',
      NEW.bicicleta_id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger sobre UPDATE de viajes (cuando algo cambia en un viaje activo)
DROP TRIGGER IF EXISTS trg_alerta_viaje_anormal ON public.viajes;
CREATE TRIGGER trg_alerta_viaje_anormal
  AFTER UPDATE ON public.viajes
  FOR EACH ROW
  WHEN (NEW.estado = 'activo')
  EXECUTE FUNCTION public.fn_alerta_viaje_anormal();

-- También alerta para bici en estado mantenimiento más de 7 días
CREATE OR REPLACE FUNCTION public.fn_alerta_mantenimiento_urgente()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_dias NUMERIC;
BEGIN
  IF NEW.estado != 'mantenimiento' THEN
    RETURN NEW;
  END IF;

  SELECT EXTRACT(EPOCH FROM (now() - m.fecha)) / 86400
  INTO v_dias
  FROM public.mantenimientos m
  WHERE m.bicicleta_id = NEW.id
  ORDER BY m.fecha DESC
  LIMIT 1;

  IF v_dias IS NOT NULL AND v_dias > 7 THEN
    INSERT INTO public.alertas (tipo, nivel, titulo, mensaje, bicicleta_id)
    VALUES (
      'mantenimiento_urgente',
      'warning',
      'Mantenimiento prolongado: ' || NEW.codigo,
      'La bicicleta lleva ' || ROUND(v_dias) || ' días en mantenimiento. Revisar estado.',
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerta_mantenimiento_urgente ON public.bicicletas;
CREATE TRIGGER trg_alerta_mantenimiento_urgente
  AFTER UPDATE OF estado ON public.bicicletas
  FOR EACH ROW
  WHEN (NEW.estado = 'mantenimiento')
  EXECUTE FUNCTION public.fn_alerta_mantenimiento_urgente();

DO $$
BEGIN
  RAISE NOTICE '✅ Migración 005 completada';
  RAISE NOTICE '   + trigger fn_alerta_viaje_anormal (viaje > 120 min)';
  RAISE NOTICE '   + trigger fn_alerta_mantenimiento_urgente (bici en mant. > 7 días)';
END;
$$;
