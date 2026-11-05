# Muestras para pruebas

Archivos de ejemplo para probar el importador de recetas y, más adelante, la
lectura de tickets. No forman parte de la aplicación y no se publican.

## Libros

Hay dos grupos:

**Recetarios reales** descargados por el usuario, para probar maquetaciones
modernas. Se usan solo como datos de prueba locales:

| Archivo | Páginas | Particularidad |
|---|---:|---|
| `libros/recetario_cocina_gallega.pdf` | 99 | Recetas con bloque de tiempo/raciones/coste/calorías |
| `libros/recetario_ensaladas.pdf` | 64 | Páginas duplicadas y títulos que no están en el texto |
| `libros/recetas-cocina-italiana-web.pdf` | 290 | Portada de título por receta y texto a dos columnas |

**Libros clásicos** de dominio público, descargados de Project Gutenberg y
maquetados en tres estilos distintos:

| Archivo | Obra original | Estilo |
|---|---|---|
| `libros/el-libro-de-la-casa.pdf` | *The Book of Household Management*, Mrs. Beeton (1861) | Libro continuo, recetas numeradas con ingredientes |
| `libros/la-cocina-blanca.pdf` | *The Whitehouse Cookbook*, F. L. Gillette y Hugo Ziemann (1887) | Fichas por receta, prosa y algunas listas |
| `libros/la-ama-de-casa.pdf` | *The Book of Household Management*, Mrs. Beeton (1861), sección de pasteles | Texto a dos columnas, recetas dentro de párrafos |

Textos de Project Gutenberg, de dominio público.

## Tickets

Fotos de tickets reales alojadas en Wikimedia Commons:

| Archivo | Autor | Licencia | Origen |
|---|---|---|---|
| `tickets/tesco-1994.jpg` | Tesco | Dominio público | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Tesco_grocery_receipt_Finchley_1994.jpg) |
| `tickets/sahan-2021.jpg` | Donald Trung | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sahan_Supermarket_receipt,_Hillegersberg,_Rotterdam_(2021)_01.jpg) |
| `tickets/sahan-2021-02.jpg` | Donald Trung | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sahan_Supermarket_receipt,_Hillegersberg,_Rotterdam_(2021)_02.jpg) |

Las imágenes se redujeron a un máximo de 1400 px para mantener el repositorio
ligero. Se usan solo como datos de prueba locales.

## Cómo se usan

```bash
# Analizar un libro desde la app
./target/debug/misuper-desktop --pdf tests/fixtures/libros/el-libro-de-la-casa.pdf

# Ejecutar las pruebas de segmentación
cargo test -p misuper-desktop --lib importar -- --nocapture
```
