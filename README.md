# UNA Connect — Proyecto de Estructuras de Datos (UNA)

Simulación de una red social universitaria donde los usuarios pueden registrarse, iniciar sesión, establecer amistades, compartir publicaciones y participar en clubes.

El sistema está desarrollado en JavaScript con una arquitectura cliente-servidor. Utiliza archivos JSON para la persistencia de datos e implementa estructuras de datos para administrar usuarios, relaciones sociales y clubes.

## Estructura del proyecto

```text
una-connect/
├── server.js                  # Servidor, sesiones y acciones del sistema
├── amistades.js               # Gestión de solicitudes y amistades
├── data/                      # Archivos JSON para persistencia
├── public/
│   └── js/
│       └── vistas.js          # Interfaz y vistas de la aplicación
└── README.md                  # Documentación del proyecto
```

*Se muestran los archivos conocidos. La estructura puede ampliarse con los demás módulos del repositorio.*

## Cómo correrlo

Desde la terminal, ubicarse en la carpeta principal del proyecto y ejecutar:

```bash
node server.js
```

Posteriormente, abrir en el navegador la dirección local indicada por el servidor.

## Distribución del trabajo

| Integrante | Módulo | Responsabilidades |
|---|---|---|
| Manuel | Persistencia, servidor, integración y autenticación | Carga y guardado de archivos JSON, rutas del servidor, sesiones, integración de módulos, registro de usuarios, inicio de sesión, validaciones y hash de contraseñas. |
| Scarlet | Interacción social y muro | Buscador de usuarios, envío y aceptación de solicitudes de amistad, lista de amigos y publicaciones ordenadas de la más reciente a la más antigua. |
| Cris | Clubes y grafo | Creación de clubes, unión y salida de clubes, categorías, tablones, listas de adyacencia y representación gráfica de relaciones. |

## Bitácora de uso de IA

> Completar honestamente por cada integrante: prompt utilizado, para qué parte del código y cómo el equipo revisó o adaptó esa salida.

| Fecha | Integrante | Módulo | Prompt (resumen) | Ajustes hechos por el equipo |
|---|---|---|---|---|
|14-11-2026| Manuel | `server.js` | asistencia utilizada en la implementación del servidor, manejo de sesiones, rutas y persistencia de datos JSON. | Pendiente de documentar. |
|15-11-2026| Manuel | Autenticación | consultas relacionadas con el registro de usuarios, inicio de sesión, validaciones y hash de contraseñas. | Pendiente de documentar. |
|15-11-2026| Scarlet | `amistades.js` |consultas relacionadas con solicitudes de amistad, aceptación, eliminación de amigos y validación de relaciones entre usuarios. | Pendiente de documentar. |
|16-11-2026| Scarlet | `public/js/vistas.js` | consultas relacionadas con la interfaz, lista de amigos, confirmación de eliminación y actualización de las vistas. | Pendiente de documentar. |
|16-11-2026| Cris | Clubes |  consultas relacionadas con creación de clubes, categorías, miembros y tablones de publicaciones. | Pendiente de documentar. |
|16-11-2026| Cris | Grafo |  consultas relacionadas con listas de adyacencia y representación gráfica de relaciones. | Pendiente de documentar. |

## Nota sobre el uso de IA

Durante el desarrollo del proyecto se contempla el uso de herramientas de inteligencia artificial como apoyo para comprender conceptos, analizar algoritmos, revisar código y resolver dudas de implementación.

Cada integrante debe documentar las consultas que realmente realizó, indicando los cambios y validaciones aplicados antes de integrar el código al proyecto.

El equipo es responsable de revisar, comprender y verificar el funcionamiento del código entregado.
