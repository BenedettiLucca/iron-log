# RESULTADO FINAL — Harness Benchmark (W0–W3, 28-30/09/2026)

## Decisão do Lucca (baseada nos dados):

1. **omp = default com oc-executor-free** (81% acerto a 346K tokens/sessão — economia de free tokens importa)
2. **opencode = default com os free models nativos do zen**: LongCat 2.5 Preview Free, Space Bunny Free, MiMo-V2.6-Flash Free, Muse Spark 1.3 Free, Ling 3.0 Flash Fin Free, Nemotron 3.5 Lightning Free, Nemotron 3 Ultra Free, Big Pickle
3. **cline permanece** no stack (free models próprios)
4. **Remover**: pi, qwen-code (harnesses sem papel default)
5. **omp via AUR**: oh-my-pi-bin / oh-my-pi / omp-bin (chaotic-aur tem oh-my-pi-git)

## Números finais (176 sessões, 8 cases × réplica × harness × backbone):

### oc-executor-free
| harness | acerto | tok/sessão | tc(PASS) | tempo |
|---|---|---|---|---|
| opencode | 88% | 652K | 12 | 184s |
| omp | **81%** | **346K** | 165 | 99s |
| pi | 88% | 905K | 149 | 150s |
| qwen | 81% | 814K | n/a | 136s |
| cline | 62% | 431K | 5 | 144s |

### space-bunny-alpha
| harness | acerto | tok/sessão | tc(PASS) | tempo |
|---|---|---|---|---|
| pi | 93% | 1.53M | 405 | 204s |
| qwen | 81% | 1.76M | n/a | 153s |
| omp | 69% | 818K | 349 | 128s |
| cline | 44% | 184K | 5 | 82s |
| opencode | 19% | 240K | 6 | 36s |

### mimo-v2.6-flash-free (só opencode, fingerprint zen)
| harness | acerto | tok/sessão | tc(PASS) | tempo |
|---|---|---|---|---|
| opencode | 69% | 207K | 10 | 126s |

## Metodologia
- 8 cases screening (4 reais sintoma-driven de MOAI/Meetcap + 4 sintéticos), revisão adversarial cega por subagente isolado
- Tokens: call_logs do OmniRoute (janela por sessão) + usage events do stdout do OpenCode (mimo nativo)
- Checks: hidden tests + no-op + escopo + build-sanity
- Bug pego na auditoria: allowlist de escopo dos sintéticos sem tests/ (40 sessões reclassificadas)

## Conhecimento preservado
- DSH (DeepSeek Harness) × gateway OpenAI-style: incompat SSE estrutural além do [DONE] ausente
- pi exige >=24K ctx; opencode-zen free tier só funciona de dentro do app OpenCode (fingerprint)
- openrouter/stealth/space-bunny-alpha: registrar via POST /api/provider-models (session auth) quando o catálogo live do OmniRoute estiver atrás
- Artifacts completos: ~/Experiments/harness-eval-2026-09-23/results/ (1 dir por sessão: prompt, diff, stdout, hidden test output, verdict)
