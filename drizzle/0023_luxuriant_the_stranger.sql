ALTER TABLE `exercises` ADD `equipment` text;--> statement-breakpoint
UPDATE `exercises` SET `equipment` = CASE
  WHEN lower(`name`) LIKE '%barra fixa%' OR lower(`name`) LIKE '%paralela%' OR lower(`name`) LIKE '%mergulho%' OR lower(`name`) LIKE '%flexão%' OR lower(`name`) LIKE '%flexao%' OR lower(`name`) LIKE '%prancha%' OR lower(`name`) LIKE '%peso corporal%' OR lower(`name`) LIKE '%bodyweight%' THEN 'peso_corporal'
  WHEN lower(`name`) LIKE '%kettlebell%' OR lower(`name`) LIKE '% kb %' OR lower(`name`) LIKE 'kb %' OR lower(`name`) LIKE '% kb' THEN 'kettlebell'
  WHEN lower(`name`) LIKE '%elástico%' OR lower(`name`) LIKE '%elastico%' OR lower(`name`) LIKE '%band%' THEN 'elastico'
  WHEN lower(`name`) LIKE '%crossover%' OR lower(`name`) LIKE '%cross over%' OR lower(`name`) LIKE '%face pull%' OR lower(`name`) LIKE '%pulley%' OR lower(`name`) LIKE '%pulldown%' OR lower(`name`) LIKE '%cabo%' OR lower(`name`) LIKE '%cabos%' OR lower(`name`) LIKE '%cable%' THEN 'cabos'
  WHEN lower(`name`) LIKE '%máquina%' OR lower(`name`) LIKE '%maquina%' OR lower(`name`) LIKE '%machine%' OR lower(`name`) LIKE '%leg press%' OR lower(`name`) LIKE '%hack%' OR lower(`name`) LIKE '%smith%' OR lower(`name`) LIKE '%peck deck%' OR lower(`name`) LIKE '%pec deck%' OR lower(`name`) LIKE '%voador%' OR lower(`name`) LIKE '%extensor%' OR lower(`name`) LIKE '%extensora%' OR lower(`name`) LIKE '%flexor%' OR lower(`name`) LIKE '%flexora%' OR lower(`name`) LIKE '%abdutora%' OR lower(`name`) LIKE '%adutora%' THEN 'maquina'
  WHEN lower(`name`) LIKE '%halter%' OR lower(`name`) LIKE '%halteres%' OR lower(`name`) LIKE '%dumbbell%' OR lower(`name`) LIKE '%dumbell%' THEN 'halteres'
  WHEN lower(`name`) LIKE '%barra%' OR lower(`name`) LIKE '%barbell%' THEN 'barra'
  ELSE NULL
END
WHERE `equipment` IS NULL;
