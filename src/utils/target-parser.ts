export const parseTarget = (target: string | null | undefined) => {
  if (!target) return { reps: '', weight: '' };

  let reps = '';
  let weight = '';

  // Tenta encontrar padrão de Peso (ex: 50kg, 12.5kg)
  const weightMatch = target.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (weightMatch) {
    weight = weightMatch[1];
  }

  // Tenta encontrar padrão de Repetições (ex: 3x10, 4x12-15)
  // Pega o número APÓS o 'x' (ex: 10 em 3x10) ou apenas um número isolado se não houver 'kg' perto
  const setsRepsMatch = target.match(/(\d+)\s*x\s*(\d+)/i);
  
  if (setsRepsMatch) {
    reps = setsRepsMatch[2]; // 3x10 -> captura 10
  } else {
    // Se não achar NxN, tenta achar um número isolado que não seja o peso
    // Remove o peso da string para não confundir
    const cleanTarget = target.replace(/(\d+(?:\.\d+)?)\s*kg/i, '');
    const singleNumberMatch = cleanTarget.match(/\b(\d+)\b/);
    if (singleNumberMatch) {
      // Assumimos que número sozinho é repetição (ex: "12 reps")
      reps = singleNumberMatch[1];
    }
  }

  return { reps, weight };
};
