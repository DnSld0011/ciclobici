-- ==============================================================
-- CicloBici — Completar flota: cada estación activa queda con
-- al menos el 85% de su capacidad en bicicletas ancladas.
-- Crea solo las bicicletas que falten (no borra ni mueve nada).
-- Seguro de correr más de una vez.
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- ==============================================================

DO $$
DECLARE
  est       RECORD;
  actuales  INT;
  objetivo  INT;
  faltan    INT;
  seq       INT;
  i         INT;
  tipo_b    TEXT;
  marca_b   TEXT;
  modelo_b  TEXT;
  creadas   INT := 0;
BEGIN
  -- Continuar la numeración desde el total actual de bicicletas
  SELECT COUNT(*) INTO seq FROM bicicletas;

  FOR est IN
    SELECT id, nombre, capacidad
    FROM estaciones
    WHERE estado = 'activa'
    ORDER BY nombre
  LOOP
    -- Bicis actualmente ancladas en la estación (cualquier estado con dock)
    SELECT COUNT(*) INTO actuales
    FROM bicicletas
    WHERE estacion_id = est.id;

    objetivo := CEIL(COALESCE(est.capacidad, 10) * 0.85);
    faltan   := objetivo - actuales;

    IF faltan <= 0 THEN
      RAISE NOTICE '%: ya tiene % de % (objetivo %) — OK', est.nombre, actuales, est.capacidad, objetivo;
      CONTINUE;
    END IF;

    FOR i IN 1..faltan LOOP
      seq := seq + 1;

      -- 70% mecánicas, 30% eléctricas
      IF random() < 0.70 THEN
        tipo_b   := 'mecanica';
        marca_b  := (ARRAY['Oyama','Monark','Goliat','BH'])[1 + floor(random()*4)::INT];
        modelo_b := (ARRAY['Urban 100','City Rider','Classic 26','Eco Move'])[1 + floor(random()*4)::INT];
      ELSE
        tipo_b   := 'electrica';
        marca_b  := (ARRAY['Xiaomi','Segway','Ecomove'])[1 + floor(random()*3)::INT];
        modelo_b := (ARRAY['E-Bike Pro','Volt 250','GreenRide'])[1 + floor(random()*3)::INT];
      END IF;

      INSERT INTO bicicletas (codigo, qr_code, tipo, marca, modelo, estado, estacion_id)
      VALUES (
        'BC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq::TEXT, 4, '0'),
        'BC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(seq::TEXT, 4, '0'),
        tipo_b, marca_b, modelo_b,
        'disponible',
        est.id
      );

      creadas := creadas + 1;
    END LOOP;

    RAISE NOTICE '%: tenía %, se crearon % → ahora % de % (capacidad)',
      est.nombre, actuales, faltan, actuales + faltan, est.capacidad;
  END LOOP;

  RAISE NOTICE 'Completado: % bicicletas nuevas creadas.', creadas;
END $$;
