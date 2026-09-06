ALTER TABLE `exercises` ADD `muscle_group` text;--> statement-breakpoint
UPDATE `exercises` SET `muscle_group` = CASE
  WHEN lower(`name`) LIKE '%crucifixo invertido%' THEN 'ombros'
  WHEN lower(`name`) LIKE '%elevação lateral%' OR lower(`name`) LIKE '%elevacao lateral%' THEN 'ombros'
  WHEN lower(`name`) LIKE '%elevação frontal%' OR lower(`name`) LIKE '%elevacao frontal%' THEN 'ombros'
  WHEN lower(`name`) LIKE '%desenvolvimento%' OR lower(`name`) LIKE '%militar%' OR lower(`name`) LIKE '%face pull%' OR lower(`name`) LIKE '%arnold%' OR lower(`name`) LIKE '%remada alta%' OR lower(`name`) LIKE '%ombro%' THEN 'ombros'
  WHEN lower(`name`) LIKE '%supino%' OR lower(`name`) LIKE '%crucifixo%' OR lower(`name`) LIKE '%crossover%' OR lower(`name`) LIKE '%cross over%' OR lower(`name`) LIKE '%peck deck%' OR lower(`name`) LIKE '%pec deck%' OR lower(`name`) LIKE '%voador%' OR lower(`name`) LIKE '%flexão%' OR lower(`name`) LIKE '%flexao%' OR lower(`name`) LIKE '%peitoral%' OR lower(`name`) LIKE '%peito%' THEN 'peito'
  WHEN lower(`name`) LIKE '%puxada%' OR lower(`name`) LIKE '%remada%' OR lower(`name`) LIKE '%terra%' OR lower(`name`) LIKE '%pulldown%' OR lower(`name`) LIKE '%barra fixa%' OR lower(`name`) LIKE '%serrote%' OR lower(`name`) LIKE '%costas%' OR lower(`name`) LIKE '%dorsal%' THEN 'costas'
  WHEN lower(`name`) LIKE '%agachamento%' OR lower(`name`) LIKE '%leg press%' OR lower(`name`) LIKE '%extensor%' OR lower(`name`) LIKE '%flexor%' OR lower(`name`) LIKE '%stiff%' OR lower(`name`) LIKE '%panturrilha%' OR lower(`name`) LIKE '%gemeos%' OR lower(`name`) LIKE '%gêmeos%' OR lower(`name`) LIKE '%passada%' OR lower(`name`) LIKE '%avanço%' OR lower(`name`) LIKE '%avanco%' OR lower(`name`) LIKE '%pélvica%' OR lower(`name`) LIKE '%pelvica%' OR lower(`name`) LIKE '%búlgaro%' OR lower(`name`) LIKE '%bulgaro%' OR lower(`name`) LIKE '%abdutora%' OR lower(`name`) LIKE '%adutora%' OR lower(`name`) LIKE '%quadríceps%' OR lower(`name`) LIKE '%quadriceps%' OR lower(`name`) LIKE '%perna%' THEN 'pernas'
  WHEN lower(`name`) LIKE '%rosca%' OR lower(`name`) LIKE '%biceps%' OR lower(`name`) LIKE '%bíceps%' THEN 'biceps'
  WHEN lower(`name`) LIKE '%triceps%' OR lower(`name`) LIKE '%tríceps%' OR lower(`name`) LIKE '%paralela%' OR lower(`name`) LIKE '%mergulho%' THEN 'triceps'
  WHEN lower(`name`) LIKE '%abdominal%' OR lower(`name`) LIKE '%prancha%' OR lower(`name`) LIKE '%core%' OR lower(`name`) LIKE '%infra%' OR lower(`name`) LIKE '%supra%' THEN 'core'
  ELSE NULL
END
WHERE `muscle_group` IS NULL;
