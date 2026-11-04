# Formatos CSV de importación y exportación

Los formatos de alumnos y preguntas tienen una sola autoridad en código:
`packages/contracts/src/csvFormats.ts`. Ahí están el encabezado, la lectura
de una fila y la escritura de una fila, así que importar y exportar usan
exactamente las mismas reglas.

Reglas comunes:

- UTF-8; la exportación agrega BOM para que Excel lo abra bien.
- Separador `,`, comillas `"` según RFC 4180 (una celda puede tener comas,
  comillas `""` y saltos de línea).
- El encabezado se compara sin distinguir mayúsculas ni tildes
  (`contrasena` vale como `contraseña`) y en cualquier orden; las columnas
  extra se ignoran.
- La exportación antepone `'` a las celdas que empiezan con `= + - @`
  (inyección de fórmulas); la importación quita ese `'`.
- Las listas dentro de una celda se separan con `|`.

---

## Alumnos

```csv
legajo,nombre,contraseña
A001,Ana Pérez,clave-inicial
A002,"Gómez, Luis",
```

- `legajo`: obligatorio; es `users.username`.
- `nombre`: obligatorio.
- `contraseña`: opcional. Un alumno nuevo la necesita. Si el legajo ya
  existe y la celda viene vacía, se conserva la contraseña actual; si viene
  con valor, se reemplaza y se sube `auth_epoch` (se cierran sus sesiones).
- Los campos de alumno configurables no forman parte del CSV; reimportar
  no los modifica.

Endpoints (Admin):

- `POST /candidates/import` con `{ rows: [{ username, name, password? }] }`.
- `GET /candidates/export`: `alumnos.csv` con todos los alumnos. La columna
  `contraseña` sale vacía porque solo se guarda el hash.
- `GET /candidate-fields/template`: `{ headers: ["legajo","nombre","contraseña"] }`.

---

## Preguntas

```csv
tipo,enunciado,opciones,respuesta,columnas,criterio,dificultad,etiquetas
single_choice,¿Cuánto es 2 + 2?,3|4|5,B,,,1,aritmetica
multiple_choice,¿Cuáles son primos?,2|3|4|9,A|B,,,2,aritmetica
true_false,La Tierra gira alrededor del Sol,,verdadero,,,1,ciencias
fill_blank,La capital de Francia es ____,,París,,,1,geografia
text_response,Explicá el ciclo del agua,,,,Menciona evaporación,3,ciencias
likert,Indicá tu acuerdo,Las clases fueron claras|El material fue útil,1|2,De acuerdo|Neutral|En desacuerdo,,1,encuesta
ranking,Ordená de menor a mayor,1|5|10|50,,,,2,aritmetica
```

| Columna      | Contenido                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------- |
| `tipo`       | `single_choice`, `multiple_choice`, `true_false`, `fill_blank`, `text_response`, `likert`, `ranking` |
| `enunciado`  | Texto de la pregunta; `fill_blank` necesita `____`. Se exporta la versión de texto plano.     |
| `opciones`   | Opciones separadas por `\|`; reciben los ids `A`, `B`, `C`… En `likert` son las filas; en `ranking`, el orden correcto. |
| `respuesta`  | Elección: letras (`B`, `A\|C`). `true_false`: `verdadero`/`falso`. `fill_blank`: el texto. `text_response`: respuesta de referencia opcional. `likert`: columna correcta de cada fila, desde 1 (`1\|3`). `ranking`: vacío. |
| `columnas`   | Solo `likert`: etiquetas de la escala.                                                        |
| `criterio`   | Solo `text_response`: criterio de corrección.                                                 |
| `dificultad` | 1 a 5; vacío = 3.                                                                             |
| `etiquetas`  | Etiquetas separadas por `\|`.                                                                  |

Cada fila se convierte en el mismo cuerpo que `POST /questions` y se valida
con `CreateQuestionRequestSchema`; una fila inválida se informa con su número
y no se guarda. Las imágenes y el formato enriquecido no viajan en el CSV.

Endpoints (Admin y Docente):

- `POST /questions/import` con `{ rows: [registro por encabezado], confirm }`.
  Con `confirm: false` solo valida.
- `GET /questions/export`: `preguntas.csv` con todas las preguntas del banco.

---

## 成绩导出

### 权限

- Phase 1: Admin。
- Phase 3 future: scoped ResultViewer / Teacher-like roles。
- Phase 4 future: SuperAdmin only if optional multiTenant returns。

SuperAdmin 不出现在 Phase 1 当前权限中。

### CSV 格式

**导出内容**: 某次考试的结果 CSV。

**列结构**:

```csv
考生姓名,<field1>,<field2>,...,成绩,及格状态,尝试次数,提交时间
```

**示例 - 默认字段**:

```csv
考生姓名,编号,部门,成绩,及格状态,尝试次数,提交时间
张三,CAND001,研发部,85,及格,1,2024-06-01T10:05:00.000Z
李四,CAND002,运营部,72,及格,1,2024-06-01T10:08:00.000Z
```

### 导出端点

**端点**: `GET /exams/:id/export/scores`

**响应**:

- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="scores-<exam-id>-<timestamp>.csv"`

### 字段说明

| 字段                | 说明                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `考生姓名`          | Candidate 的 `name` 字段                                                   |
| `field1, field2...` | 当前部署 / default organization 的 CandidateField 字段，按 `sortOrder` 排序 |
| `成绩`              | 最终得分（number）                                                         |
| `及格状态`          | “及格” 或 “不及格”                                                         |
| `尝试次数`          | 累计考试次数（number）                                                     |
| `提交时间`          | ISO 8601 格式日期时间字符串                                                |

### 导出规则

1. **动态列**: 列标题根据系统配置的 CandidateField 动态生成。
2. **空值处理**: 自定义字段空值显示为空字符串。
3. **时间格式**: ISO 8601 格式：`YYYY-MM-DDTHH:mm:ss.sssZ`。
4. **审计**: Phase 1 result CSV export 应写入最小 AuditLog。
5. **大文件导出**: Phase 1 可以同步 CSV；Phase 2 已实现 export job / large export / job log。
