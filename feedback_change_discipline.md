---
name: Disciplina en cambios concurrentes
description: Cuando agentes se bloquean y hago cambios directos, documentar claramente qué archivos se tocaron, qué resuelve cada cambio, y validar que no rompe el flujo. Preferir pocas mejoras robustas sobre muchas dispersas.
type: feedback
---

Cuando agentes background se bloquean y decido hacer cambios directos:
1. Documentar exactamente qué archivos se modificaron
2. Explicar qué problema resuelve cada cambio individual
3. Validar que no rompe el flujo existente antes de pasar al siguiente

**Why:** El usuario prioriza robustez sobre volumen. Muchas mejoras pequeñas simultáneas crean riesgo de dispersión y hacen difícil rastrear qué rompió qué.

**How to apply:** Antes de lanzar múltiples cambios en paralelo, evaluar si es mejor hacerlos secuencialmente con validación entre cada uno. Menos vistoso pero más sólido. Al reportar, ser explícito sobre: archivo → problema → solución → validación.
