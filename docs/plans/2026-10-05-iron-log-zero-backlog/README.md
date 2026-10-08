# Épico: Iron Log — backlog zero com execução contínua

**Status:** plano detalhado, sem execução autorizada/iniciada.  
**Executor/orquestrador:** GLM 5.3 Flash.  
**Escopo congelado:** 20 issues, 14 comentários; `master` em `9c0b808d1c1e24ea9f3fbba611031cc5cfd5794b`.  
**Coleta:** 05/10/2026; reconciliação final do inventário e SHA remoto em 06/10/2026.  
**Decomposição:** 88 pacotes de contrato, schema, núcleo, integração e QA; não são 88 issues novas.

## Como usar

- **Visão completa:** [PLAN.md](PLAN.md).
- **Escopo e aceite por issue:** [ISSUE-PACKAGES.md](ISSUE-PACKAGES.md).
- **Atribuição, fallback e DAG:** [WORK-PACKAGES.md](WORK-PACKAGES.md), [execution-ledger.json](execution-ledger.json).
- **Estado real dos executores:** [FLEET-PREFLIGHT.md](FLEET-PREFLIGHT.md).
- **Brief para entregar ao GLM:** [GLM-HANDOFF.md](GLM-HANDOFF.md).
- **Evidência das fontes:** [issues e comentários](evidence/issues-snapshot.json), [benchmarks e proveniência](evidence/benchmark-routing-evidence.json), [screening local](evidence/HARNESS-SCREENING.md).
- **Validação estrutural do plano:** `python validate-plan.py`. Isso não executa desenvolvimento nem valida o app.

Os documentos técnicos/briefs estão em inglês para consumo dos coding agents. Este resumo é para o Lucca. Não criei o épico no GitHub; este pacote é o plano local, pronto para handoff.

## Estratégia

**Fila contínua, não waves bloqueantes.** Slot competente livre assume o próximo pacote elegível. Se o melhor candidato está indisponível, segue imediatamente a ordem de fallback. Codex é o último recurso, não reviewer padrão.

Paralelização máxima **segura**: duas sessões por modelo efetivo, somando implementação, review e probes; quotas Gemini/Claude separadas; até12 slots primários nominais. Combo do omp e Cursor auto não ganham slots extras por serem aliases. Identidade desconhecida impede provar o teto; essa rota fica inelegível até resolver o controle, enquanto outras trabalham.

Um writer por schema/migration e por invariantes compartilhadas de sessão/exports; contratos revisados liberam módulos e testes independentes antes de merge na master. Gates pesados e Android têm filas próprias. Uma dúvida de produto bloqueia apenas quem depende dela.

## Frentes e issues cobertas

| Frente | Issues | Caminho principal |
|---|---|---|
| Integridade e relatórios | #151, #147, #148, #149, #136 | Cobertura real do Notion → proveniência do peso/separação da avaliação → exportadores → unidades nos consumers |
| Composição da sessão | #81, #80, #79, #66, #82 | Snapshot por ocorrência → freestyle/superset; micro/cardio desenvolvem núcleo independente e integram depois |
| Rotinas e calendário | #64, #95, #67 | Archive; data planejada separada da realizada; drift com semântica explícita |
| Sinais e contexto | #74, #75, #70, #72 | Plateau local; peso/proveniência + sinal de corte; contratos externos para nutrição/readiness |
| Infra, prova nativa e performance | #112, #114, #150 | Dev build/decisão de SDK → notificação com processo morto; budget de undo independente |

## Roteamento fundamentado, sem ranking inventado

- **Gemini 3.8 Flash/high + AGY:** melhor evidência diretamente útil de agente/harness entre os primários consultados; primeira opção para sessão/schema e build/integração. AA Coding Agent1.5: fração `0.4186315529449987`.
- **Sonnet5.5/high + AGY:** contratos/review e trabalho complexo depois de qualificação. AA Intelligence max56 **não** é score de coding do high instalado. Não foi encontrada observação de coding exata nesta coleta.
- **omp / Agnes–Grok:** mudanças focadas e testes após qualificar o backend real. Screening histórico da combinação omp:81%, mas não transfere para a cadeia atual.
- **OpenCode / MiMo2.6Flash:** mudanças bounded, testes e helpers depois de confirmar a rota; screening histórico69%.
- **Cline / DeepSeek4.1Flash:** alternativa para testes, debugging/terminal e UI bounded; benchmark max não equivale ao xhigh local sem nova qualificação.
- **Cursor auto:** trabalho isolado quando o backend/cap estiverem controlados. Auto não tem score próprio.
- **Codex / Luna5.6max:** fallback condicionado; AA Coding Agent1.5 `0.4322468668029613`. Score maior não revoga sua política de fallback.

Fontes: [Artificial Analysis modelos](https://artificialanalysis.ai/models), [AA coding agents](https://artificialanalysis.ai/agents/coding-agents), [Benchmark Heaven](https://benchmarkheaven.com/charts). Protocolos/datas/effort/harness estão preservados no pacote; índices distintos não foram somados em um score artificial.

## Descobertas que o executor precisa respeitar

1. **#64 não é QA-only:** comentário cita entrega, mas schema/hooks/migration não estão na master atual. Implementação + QA são necessárias, salvo recuperação e qualificação de um branch real.
2. **Sonnet5.5 aparece no catálogo AGY** na reconciliação final, em low/medium/high; um snapshot anterior do subagente estava desatualizado.
3. **OpenCode ainda retorna catálogo vazio**; MiMo não está confirmado. Seu default configurado coincide com o combo do omp.
4. **Combo atual do omp não contém Grok4.6** e inclui14 candidatos, vários fora da lista solicitada/aliases opacos. Grok4.6 existe como rota separada; não presumir que o combo vai servi-lo.
5. **Node26/npm11 globais estão fora do pin** do repo. Usar Node22.22.2/npm10.9.7 isolados.
6. **#95 precisa definir dias planejados:** programa atual associa rotina à semana, não ao dia. Sem isso, “overdue” em #67 seria inventado.
7. **#70/#72 dependem de contratos externos reais.** Fixtures não provam integração com Alexandria.
8. **#72/#75 são health-adjacent:** thresholds/copy e eventual mudança de aceite precisam de decisão explícita; testes não validam causalidade clínica.
9. **CI tem cobertura split e lint zero-warning.** `npm run verify` sozinho não reproduz seu fluxo.
10. **qa.sh smoke cobre só abertura.** Features precisam de flows direcionados; `doctor` e `receipt` não existem no script atual.

## Critério de encerramento

Cada issue exige todos os critérios aprovados, testes reais, review independente sem findings, integração/gates no SHA final e QA nativo/live quando aplicável. Branch pronta não é issue fechada. Push/merge/closure exigem autorização específica e readback do alvo.

“Nunca parar” significa **nunca ficar ocioso havendo trabalho seguro e elegível**. Se só restarem credenciais, decisão do dono ou capacidade nativa ausente, o GLM deve mostrar o bloqueio — não afrouxar gate nem inventar atividade.

Nenhum modelo de coding foi acionado, nenhum teste/build do app foi executado e nenhuma issue foi alterada durante este planejamento.
