# Evidências de fixes de performance no repositório

## 1) Correção de N+1

Sem evidência no repositório.

Procurámos no histórico do git e na árvore do projeto por termos como `N+1`, `n+1`, `populate`, `lean`, `select`, `batch`, `query` e por mensagens de commit relacionadas com "optimize catalog reads". O único commit explícito de performance do catálogo foi `0227d37 perf: optimize catalog reads and capacity testing`, mas a mensagem e os ficheiros alterados descrevem otimização do catálogo e do harness de capacidade, não uma correção formal de N+1 com regressão antes/depois documentada.

## 2) Remoção de gargalo single-threaded

Sem evidência no repositório.

Não houve commit com mensagem equivalente a "remove single-threaded bottleneck", nem referência a um gargalo em worker único, event loop, fila serial ou CPU-bound em código. O projeto tem um Web Worker para cálculo de preço (`frontend/src/workers/priceCalculator.worker.ts`), mas isso não prova uma correção de gargalo single-threaded na camada de backend, nem existe medição antes/depois documentada no repositório.

## 3) Correção de adaptador de BD mal configurado

Sem evidência no repositório.

O histórico pesquisado inclui `03a18fb Fix backend startup by awaiting MongoDB connect before server listen` e `5e46939 ci: add mongo service and MONGODB_URI to e2e-test`, que mostram correções de readiness e CI, mas não uma falha de "adaptador de base de dados mal configurado" com medição antes/depois e commit explícito. Não há mensagem de commit nem código que prove a troca de driver/adaptador por erro de configuração do banco.

## 4) Evidência positiva encontrada

### `0227d37 perf: optimize catalog reads and capacity testing`

- Commit: `0227d37`
- Ficheiros principais: `backend/server/routes/shop.ts`, `backend/server/services/productSearch.ts`, `backend/server/utils/metrics.ts`, `backend/scripts/capacity-load-test.js`, `docker-compose.capacity.yml`
- O que é provado: houve trabalho explícito para otimizar leitura de catálogo, instrumentar métricas e preparar testes de capacidade.
- Limitação: não há medição formal antes/depois em ficheiro do repositório para dizer que foi um N+1, single-threaded ou adaptador quebrado; apenas há intenção e implementação de otimização/performance.

## 5) Conclusão

O repositório contém evidência de otimização de catálogo e de testes de capacidade, mas não contém provas documentadas para os três itens que a tarefa pedia: N+1, gargalo single-threaded e adaptador de BD mal configurado. Neste estado, a forma correta é registar "sem evidência no repositório" em vez de inventar causas ou números.
